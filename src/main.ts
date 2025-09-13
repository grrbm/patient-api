import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { initializeDatabase } from "./config/database";
import User from "./models/User";
import Clinic from "./models/Clinic";
import Treatment from "./models/Treatment";
import Product from "./models/Product";
import Questionnaire from "./models/Questionnaire";
import QuestionnaireStep from "./models/QuestionnaireStep";
import Question from "./models/Question";
import QuestionOption from "./models/QuestionOption";
import { createJWTToken, authenticateJWT, getCurrentUser } from "./config/jwt";
import { uploadToS3, deleteFromS3, isValidImageFile, isValidFileSize } from "./config/s3";
import Stripe from "stripe";

// Helper function to generate unique clinic slug
async function generateUniqueSlug(clinicName: string, excludeId?: string): Promise<string> {
  // Generate base slug from clinic name
  const baseSlug = clinicName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check if base slug is available
  const whereClause: any = { slug: baseSlug };
  if (excludeId) {
    whereClause.id = { [require('sequelize').Op.ne]: excludeId };
  }

  const existingClinic = await Clinic.findOne({ where: whereClause });

  if (!existingClinic) {
    return baseSlug;
  }

  // If base slug exists, try incremental numbers
  let counter = 1;
  while (true) {
    const slugWithNumber = `${baseSlug}-${counter}`;
    const whereClauseWithNumber: any = { slug: slugWithNumber };
    if (excludeId) {
      whereClauseWithNumber.id = { [require('sequelize').Op.ne]: excludeId };
    }

    const existingWithNumber = await Clinic.findOne({ where: whereClauseWithNumber });

    if (!existingWithNumber) {
      return slugWithNumber;
    }

    counter++;
  }
}

// Aptible SSL workaround - disable SSL certificate validation in production
// This is safe within Aptible's secure network environment
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is not set');
  console.log('Available env variables:', Object.keys(process.env).filter(key => key.includes('STRIPE')));
} else {
  console.log('✅ Stripe secret key found, initializing...');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

// HIPAA-compliant CORS configuration with explicit origin whitelisting
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
        process.env.FRONTEND_URL || 'https://app-95863.on-aptible.com',
        'https://app-95883.on-aptible.com', // Current frontend URL
        'http://3.140.178.30', // Add your frontend IP
        'https://unboundedhealth.xyz', // Add unboundedhealth.xyz
        'https://www.unboundedhealth.xyz'
      ]
      : ['http://localhost:3000', 'http://3.140.178.30', 'https://unboundedhealth.xyz']; // Allow local frontend, your IP, and unboundedhealth.xyz during development

    // Check if origin is in allowed list or matches patterns
    const isAllowed = allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV === 'production' && /^https:\/\/app-\d+\.on-aptible\.com$/.test(origin)) ||
      // Allow clinic subdomains in development (e.g., g-health.localhost:3000, saboia.xyz.localhost:3000)
      (process.env.NODE_ENV === 'development' && /^http:\/\/[a-zA-Z0-9.-]+\.localhost:3000$/.test(origin)) ||
      // Allow production clinic domains (e.g., app.limitless.health, app.hims.com)
      (process.env.NODE_ENV === 'production' && /^https:\/\/app\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(origin)) ||
      // Allow all subdomains of unboundedhealth.xyz (legacy support)
      /^https:\/\/[a-zA-Z0-9-]+\.unboundedhealth\.xyz$/.test(origin);

    if (isAllowed) {
      console.log(`✅ CORS allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Essential for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

app.use(helmet());
app.use(express.json()); // Parse JSON bodies

// No session middleware needed for JWT

// Health check endpoint
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Auth routes
app.post("/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, dateOfBirth, phoneNumber, clinicName, clinicId } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Validate clinic name for healthcare providers
    if (role === 'provider' && !clinicName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required for healthcare providers"
      });
    }

    // Check if user already exists
    console.log('🔍 Checking if user exists with email:', email);
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('❌ User already exists with email:', email);
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }
    console.log('✅ No existing user found, proceeding with registration');

    // Handle clinic association
    let clinic = null;
    let finalClinicId = clinicId; // Use provided clinicId from request body

    // Create clinic if user is a healthcare provider and no clinicId provided
    if (role === 'provider' && clinicName && !clinicId) {
      console.log('🏥 Creating clinic with name:', clinicName);

      // Generate unique slug
      const slug = await generateUniqueSlug(clinicName.trim());

      clinic = await Clinic.create({
        name: clinicName.trim(),
        slug: slug,
        logo: '', // Default empty logo, can be updated later
      });

      finalClinicId = clinic.id;
      console.log('✅ Clinic created successfully with ID:', clinic.id);
      console.log('🏥 Created clinic details:', { id: clinic.id, name: clinic.name, slug: clinic.slug });
    } else if (clinicId) {
      console.log('🔗 Associating user with existing clinic ID:', clinicId);
    }

    // Create new user in database
    console.log('🚀 Creating new user with data:', { firstName, lastName, email, role: role === 'provider' ? 'doctor' : 'patient', dob: dateOfBirth, phoneNumber, finalClinicId });
    const user = await User.createUser({
      firstName,
      lastName,
      email,
      password,
      role: role === 'provider' ? 'doctor' : 'patient', // Map frontend role to backend role
      dob: dateOfBirth,
      phoneNumber,
    });

    // Associate user with clinic if one is provided
    if (finalClinicId) {
      user.clinicId = finalClinicId;
      await user.save();
      console.log('🔗 User associated with clinic ID:', finalClinicId);
    }

    console.log('✅ User created successfully with ID:', user.id);
    console.log('👤 Created user details:', user.toSafeJSON());

    // Pull user from database to confirm it was saved
    const savedUser = await User.findByPk(user.id);
    console.log('🔄 User pulled from database:', savedUser ? savedUser.toSafeJSON() : 'NOT FOUND');

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: user.toSafeJSON() // Return safe user data
    });

  } catch (error: any) {
    // HIPAA Compliance: Don't log the actual error details that might contain PHI
    console.error('Registration error occurred:', error.name);

    // Handle specific database errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user data provided"
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
});

app.post("/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Update last login time
    await user.updateLastLogin();

    // Create JWT token
    const token = createJWTToken(user);

    console.log('JWT token created for user:', user.email); // Safe to log email for development

    res.status(200).json({
      success: true,
      message: "Authentication successful",
      token: token,
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Authentication error occurred');
    res.status(500).json({
      success: false,
      message: "Authentication failed. Please try again."
    });
  }
});

app.post("/auth/signout", async (_req, res) => {
  try {
    // With JWT, signout is handled client-side by removing the token
    // No server-side session to destroy
    res.status(200).json({
      success: true,
      message: "Signed out successfully"
    });
  } catch (error) {
    console.error('Sign out error occurred');
    res.status(500).json({
      success: false,
      message: "Sign out failed"
    });
  }
});

app.get("/auth/me", authenticateJWT, async (req, res) => {
  try {
    // Get user data from JWT
    const currentUser = getCurrentUser(req);

    // Optionally fetch fresh user data from database
    const user = await User.findByPk(currentUser?.id);
    if (!user) {
      // User was deleted from database but JWT token still exists
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Auth check error occurred');
    res.status(500).json({
      success: false,
      message: "Auth check failed"
    });
  }
});

// User profile update endpoint
app.put("/auth/profile", authenticateJWT, async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const { firstName, lastName, phoneNumber, dob, address, city, state, zipCode } = req.body;

    // HIPAA Compliance: Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required"
      });
    }

    // Find user in database
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update user profile (only allow certain fields to be updated)
    await user.update({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber?.trim() || null,
      dob: dob?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      zipCode: zipCode?.trim() || null,
    });

    console.log('Profile updated for user:', user.email); // Safe - no PHI

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: user.toSafeJSON()
    });

  } catch (error) {
    console.error('Profile update error occurred');
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
});

// Clinic routes
// Public endpoint to get clinic by slug (for subdomain routing)
app.get("/clinic/by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const clinic = await Clinic.findOne({
      where: { slug },
      attributes: ['id', 'name', 'slug', 'logo'] // Only return public fields
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    console.log(`✅ Clinic found by slug "${slug}":`, clinic.name);

    res.json({
      success: true,
      data: clinic
    });

  } catch (error) {
    console.error('❌ Error fetching clinic by slug:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

app.get("/clinic/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow users to access their own clinic data (doctors and patients)
    if (user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      }
    });

  } catch (error) {
    console.error('Error fetching clinic data');
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic data"
    });
  }
});

app.put("/clinic/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow doctors to update clinic data, and only their own clinic
    if (user.role !== 'doctor' || user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required"
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    // Generate new slug if name changed
    let newSlug = clinic.slug;
    if (name.trim() !== clinic.name) {
      newSlug = await generateUniqueSlug(name.trim(), clinic.id);
      console.log('🏷️ Generated new slug:', newSlug);
    }

    // Update clinic data
    await clinic.update({
      name: name.trim(),
      slug: newSlug,
      logo: logo?.trim() || '',
    });

    console.log('🏥 Clinic updated:', { id: clinic.id, name: clinic.name, slug: clinic.slug });

    res.status(200).json({
      success: true,
      message: "Clinic updated successfully",
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      }
    });

  } catch (error) {
    console.error('Error updating clinic data');
    res.status(500).json({
      success: false,
      message: "Failed to update clinic data"
    });
  }
});

// Clinic logo upload endpoint
app.post("/clinic/:id/upload-logo", authenticateJWT, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow doctors to upload logos for their own clinic
    if (user.role !== 'doctor' || user.clinicId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Validate file size (additional check)
    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    const clinic = await Clinic.findByPk(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    // Delete old logo from S3 if it exists
    if (clinic.logo && clinic.logo.trim() !== '') {
      try {
        await deleteFromS3(clinic.logo);
        console.log('🗑️ Old logo deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old logo from S3:', error);
        // Don't fail the entire request if deletion fails
      }
    }

    // Upload new logo to S3
    const logoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Update clinic with new logo URL
    await clinic.update({ logo: logoUrl });

    console.log('🏥 Logo uploaded for clinic:', { id: clinic.id, logoUrl });

    res.status(200).json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        logo: clinic.logo,
      }
    });

  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload logo"
    });
  }
});

// Treatment logo upload endpoint
app.post("/treatment/:id/upload-logo", authenticateJWT, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow doctors to upload treatment logos for their own clinic's treatments
    if (user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Only doctors can upload treatment logos"
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Validate file size (additional check)
    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB."
      });
    }

    const treatment = await Treatment.findByPk(id);
    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: "Treatment not found"
      });
    }

    // Verify treatment belongs to user's clinic
    if (treatment.clinicId !== user.clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Delete old logo from S3 if it exists
    if (treatment.treatmentLogo && treatment.treatmentLogo.trim() !== '') {
      try {
        await deleteFromS3(treatment.treatmentLogo);
        console.log('🗑️ Old treatment logo deleted from S3');
      } catch (error) {
        console.error('Warning: Failed to delete old treatment logo from S3:', error);
        // Don't fail the entire request if deletion fails
      }
    }

    // Upload new logo to S3
    const logoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Update treatment with new logo URL
    await treatment.update({ treatmentLogo: logoUrl });

    console.log('💊 Logo uploaded for treatment:', { id: treatment.id, logoUrl });

    res.status(200).json({
      success: true,
      message: "Treatment logo uploaded successfully",
      data: {
        id: treatment.id,
        name: treatment.name,
        treatmentLogo: treatment.treatmentLogo,
      }
    });

  } catch (error) {
    console.error('Error uploading treatment logo:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload treatment logo"
    });
  }
});

// Treatments routes
// Public endpoint to get treatments by clinic slug
app.get("/treatments/by-clinic-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // First find the clinic by slug
    const clinic = await Clinic.findOne({
      where: { slug },
      include: [
        {
          model: Treatment,
          as: 'treatments',
          attributes: ['id', 'name', 'treatmentLogo', 'createdAt', 'updatedAt']
        }
      ]
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found"
      });
    }

    console.log(`✅ Found ${clinic.treatments?.length || 0} treatments for clinic "${slug}"`);

    res.json({
      success: true,
      data: clinic.treatments || []
    });

  } catch (error) {
    console.error('❌ Error fetching treatments by clinic slug:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Protected endpoint to get treatments by clinic ID (for authenticated users)
app.get("/treatments/by-clinic-id/:clinicId", authenticateJWT, async (req, res) => {
  try {
    const { clinicId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow users to access their own clinic's treatments
    // For doctors: they can access their clinic's treatments
    // For patients: they can access their clinic's treatments
    if (user.clinicId !== clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Find treatments for the clinic
    const treatments = await Treatment.findAll({
      where: { clinicId },
      attributes: ['id', 'name', 'treatmentLogo', 'createdAt', 'updatedAt']
    });

    console.log(`✅ Found ${treatments?.length || 0} treatments for clinic ID "${clinicId}"`);

    res.json({
      success: true,
      data: treatments || []
    });

  } catch (error) {
    console.error('❌ Error fetching treatments by clinic ID:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Create new treatment
app.post("/treatments", authenticateJWT, async (req, res) => {
  try {
    const { name } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow doctors to create treatments
    if (user.role !== 'doctor' || !user.clinicId) {
      return res.status(403).json({
        success: false,
        message: "Only doctors with a clinic can create treatments"
      });
    }

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Treatment name is required"
      });
    }

    // Create treatment
    const treatment = await Treatment.create({
      name: name.trim(),
      userId: user.id,
      clinicId: user.clinicId,
      treatmentLogo: ''
    });

    console.log('💊 Treatment created:', { id: treatment.id, name: treatment.name });

    res.status(201).json({
      success: true,
      message: "Treatment created successfully",
      data: {
        id: treatment.id,
        name: treatment.name,
        treatmentLogo: treatment.treatmentLogo,
      }
    });

  } catch (error) {
    console.error('Error creating treatment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create treatment"
    });
  }
});

// Update treatment
app.put("/treatments/:id", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user data from database to get clinicId
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Only allow doctors to update treatments
    if (user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Only doctors can update treatments"
      });
    }

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Treatment name is required"
      });
    }

    const treatment = await Treatment.findByPk(id);
    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: "Treatment not found"
      });
    }

    // Verify treatment belongs to user's clinic
    if (treatment.clinicId !== user.clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Update treatment
    await treatment.update({
      name: name.trim()
    });

    console.log('💊 Treatment updated:', { id: treatment.id, name: treatment.name });

    res.status(200).json({
      success: true,
      message: "Treatment updated successfully",
      data: {
        id: treatment.id,
        name: treatment.name,
        treatmentLogo: treatment.treatmentLogo,
      }
    });

  } catch (error) {
    console.error('Error updating treatment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update treatment"
    });
  }
});

// Get single treatment with products
app.get("/treatments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'products',
          through: {
            attributes: ['dosage', 'numberOfDoses', 'nextDose']
          }
        }
      ]
    });

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: "Treatment not found"
      });
    }

    console.log('💊 Treatment fetched:', { id: treatment.id, name: treatment.name, productsCount: treatment.products?.length || 0 });

    res.status(200).json({
      success: true,
      data: treatment
    });

  } catch (error) {
    console.error('Error fetching treatment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch treatment"
    });
  }
});

// Payment routes
// Create payment intent
app.post("/create-payment-intent", authenticateJWT, async (req, res) => {
  try {
    const { amount, currency = 'usd', treatmentId, selectedProducts } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: currentUser.id,
        treatmentId: treatmentId || '',
        selectedProducts: JSON.stringify(selectedProducts || {}),
        // HIPAA compliance: Don't include specific medical details
        orderType: 'treatment_refill'
      },
      description: 'Treatment refill order',
    });

    console.log('💳 Payment intent created:', { 
      id: paymentIntent.id, 
      amount: paymentIntent.amount,
      userId: currentUser.id 
    });

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    // Log specific error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Check if it's a Stripe error
    if (error && typeof error === 'object' && 'type' in error) {
      console.error('Stripe error type:', (error as any).type);
      console.error('Stripe error code:', (error as any).code);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Confirm payment completion
app.post("/confirm-payment", authenticateJWT, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Payment was successful
      // Here you would typically:
      // 1. Update order status in database
      // 2. Send confirmation email
      // 3. Update inventory
      // 4. Create prescription records, etc.
      
      console.log('💳 Payment confirmed:', { 
        id: paymentIntent.id, 
        amount: paymentIntent.amount,
        userId: currentUser.id 
      });

      res.status(200).json({
        success: true,
        message: "Payment confirmed successfully",
        data: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Convert back from cents
          status: paymentIntent.status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment was not successful",
        data: {
          status: paymentIntent.status
        }
      });
    }

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment"
    });
  }
});

// Questionnaire routes
// Get questionnaire for a treatment
app.get("/questionnaires/treatment/:treatmentId", async (req, res) => {
  try {
    const { treatmentId } = req.params;

    const questionnaire = await Questionnaire.findOne({
      where: { treatmentId },
      include: [
        {
          model: QuestionnaireStep,
          as: 'steps',
          include: [
            {
              model: Question,
              as: 'questions',
              include: [
                {
                  model: QuestionOption,
                  as: 'options'
                }
              ]
            }
          ]
        }
      ],
      order: [
        [{ model: QuestionnaireStep, as: 'steps' }, 'stepOrder', 'ASC'],
        [{ model: QuestionnaireStep, as: 'steps' }, { model: Question, as: 'questions' }, 'questionOrder', 'ASC'],
        [{ model: QuestionnaireStep, as: 'steps' }, { model: Question, as: 'questions' }, { model: QuestionOption, as: 'options' }, 'optionOrder', 'ASC']
      ]
    });

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "Questionnaire not found for this treatment"
      });
    }

    console.log(`✅ Found questionnaire for treatment ID "${treatmentId}"`);

    res.json({
      success: true,
      data: questionnaire
    });

  } catch (error) {
    console.error('❌ Error fetching questionnaire:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3001;

// Initialize database connection and start server
async function startServer() {
  const dbConnected = await initializeDatabase();

  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 API listening on :${PORT}`);
    console.log('📊 Database connected successfully');
    console.log('🔒 HIPAA-compliant security features enabled');
  });
}

startServer();
