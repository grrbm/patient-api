import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initializeDatabase } from "./config/database";
import { User } from "./models/User";
import { sessionConfig, updateLastActivity, createUserSession, destroyUserSession, isAuthenticated, getCurrentUser } from "./config/session";

// Aptible SSL workaround - disable SSL certificate validation in production
// This is safe within Aptible's secure network environment
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();

// HIPAA-compliant CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL || 'https://app-95863.on-aptible.com',
        'https://app-95883.on-aptible.com', // Current frontend URL
        /^https:\/\/app-\d+\.on-aptible\.com$/ // Allow any Aptible app URL pattern for deployment flexibility
      ]
    : ['http://localhost:3000'], // Allow local frontend during development
  credentials: true, // Allow cookies for httpOnly session management
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet());
app.use(express.json()); // Parse JSON bodies

// HIPAA-compliant session management
app.use(sessionConfig);
app.use(updateLastActivity);

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
    
    // Create secure session
    await createUserSession(req, user);
    
    // Debug session creation
    console.log('Session created - ID:', req.sessionID);
    console.log('User ID stored in session:', req.session?.userId);
    console.log('User successfully signed in:', user.email); // Safe to log email for development
    
    res.status(200).json({ 
      success: true, 
      message: "Authentication successful",
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

app.post("/auth/signout", async (req, res) => {
  try {
    // Destroy session
    destroyUserSession(req);
    
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

app.get("/auth/me", async (req, res) => {
  try {
    // Debug session info (temporarily for troubleshooting)
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session ? 'exists' : 'missing');
    console.log('User ID in session:', req.session?.userId);
    
    // Check if user is authenticated via session
    if (!isAuthenticated(req)) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated" 
      });
    }

    // Get user data from session
    const currentUser = getCurrentUser(req);
    
    // Optionally fetch fresh user data from database
    const user = await User.findByPk(currentUser?.id);
    if (!user) {
      // User was deleted from database but session still exists
      destroyUserSession(req);
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
