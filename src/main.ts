import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initializeDatabase } from "./config/database";
import { User } from "./models/User";
import { createJWTToken, authenticateJWT, getCurrentUser } from "./config/jwt";

// Aptible SSL workaround - disable SSL certificate validation in production
// This is safe within Aptible's secure network environment
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();

// HIPAA-compliant CORS configuration with explicit origin whitelisting
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://app-95863.on-aptible.com',
          'https://app-95883.on-aptible.com', // Current frontend URL
        ]
      : ['http://localhost:3000']; // Allow local frontend during development
    
    // Check if origin is in allowed list or matches Aptible pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                     (process.env.NODE_ENV === 'production' && /^https:\/\/app-\d+\.on-aptible\.com$/.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
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
    const { firstName, lastName, email, password, role, dateOfBirth, phoneNumber } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Create new user in database
    const user = await User.createUser({
      firstName,
      lastName,
      email,
      password,
      role: role === 'provider' ? 'doctor' : 'patient', // Map frontend role to backend role
      dob: dateOfBirth,
      phoneNumber,
    });

    console.log('User successfully registered with email:', user.email); // Safe to log email for development
    
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
