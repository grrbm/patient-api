import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Check if we're connecting to localhost (Aptible tunnel)
const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

// HIPAA-compliant database connection
const sequelizeConfig = {
  dialect: 'postgres' as const,
  dialectOptions: {
    // SSL configuration: 
    // - Production (Aptible): require SSL with relaxed validation
    // - Localhost tunnel: use SSL but don't require it
    // - Development: no SSL
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false,
      ca: undefined, // Don't validate CA certificate
      checkServerIdentity: () => undefined, // Skip hostname verification
    } : isLocalhost ? {
      require: false, // Don't require SSL for localhost tunnel
      rejectUnauthorized: false,
    } : false,
  },
  logging: false, // Don't log SQL queries in production (could contain PHI)
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

export const sequelize = new Sequelize(databaseUrl, sequelizeConfig);

export async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
}