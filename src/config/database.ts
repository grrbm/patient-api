import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// HIPAA-compliant database connection
const sequelizeConfig = {
  dialect: 'postgres' as const,
  dialectOptions: {
    // Aptible SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false,
      ca: undefined, // Don't validate CA certificate
      checkServerIdentity: () => undefined, // Skip hostname verification
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