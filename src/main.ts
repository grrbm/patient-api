import express from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

// HIPAA-compliant CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-app.on-aptible.com'] // Update with your actual Aptible frontend URL
    : ['http://localhost:3000'], // Allow local frontend during development
  credentials: true, // Allow cookies for httpOnly session management
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet());
app.use(express.json()); // Parse JSON bodies

// Health check endpoint
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Auth routes
app.post("/auth/signup", async (req, res) => {
  try {
    // TODO: Implement actual user registration logic with database
    const { firstName, lastName, email, password, role, dateOfBirth, phoneNumber } = req.body;
    
    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }
    
    // For now, just return success (you'll need to implement actual database logic)
    console.log('User registration attempt for:', email); // Safe to log email for development
    
    res.status(201).json({ 
      success: true, 
      message: "User registered successfully" 
    });
    
  } catch (error) {
    // HIPAA Compliance: Don't log the actual error details
    console.error('Registration error occurred');
    res.status(500).json({ 
      success: false, 
      message: "Registration failed" 
    });
  }
});

app.post("/auth/signin", async (req, res) => {
  try {
    // TODO: Implement actual authentication logic
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }
    
    // For now, just return success (you'll need to implement actual auth logic)
    console.log('Sign in attempt for:', email); // Safe to log email for development
    
    res.status(200).json({ 
      success: true, 
      message: "Authentication successful" 
    });
    
  } catch (error) {
    console.error('Authentication error occurred');
    res.status(500).json({ 
      success: false, 
      message: "Authentication failed" 
    });
  }
});

app.post("/auth/signout", async (req, res) => {
  try {
    // TODO: Implement session cleanup
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
    // TODO: Implement session validation and user data retrieval
    // For now, return unauthorized
    res.status(401).json({ 
      success: false, 
      message: "Not authenticated" 
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
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
