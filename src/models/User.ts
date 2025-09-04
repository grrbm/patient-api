import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcrypt';

// User attributes interface
export interface UserAttributes {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  dob?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  role: 'patient' | 'doctor' | 'admin';
  lastLoginAt?: Date;
  consentGivenAt?: Date;
  emergencyContact?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Optional fields for creation (auto-generated)
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// User model class with HIPAA-compliant methods
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare passwordHash: string;
  declare dob?: string;
  declare phoneNumber?: string;
  declare address?: string;
  declare city?: string;
  declare state?: string;
  declare zipCode?: string;
  declare role: 'patient' | 'doctor' | 'admin';
  declare lastLoginAt?: Date;
  declare consentGivenAt?: Date;
  declare emergencyContact?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Instance methods
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }

  public async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }

  public async recordConsent(): Promise<void> {
    this.consentGivenAt = new Date();
    await this.save();
  }

  // Return user data without sensitive information (for API responses)
  public toSafeJSON() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      dob: this.dob,
      address: this.address,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
      role: this.role,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    };
  }

  // Static methods
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // HIPAA requires strong password hashing
    return bcrypt.hash(password, saltRounds);
  }

  public static async createUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: 'patient' | 'doctor' | 'admin';
    dob?: string;
    phoneNumber?: string;
  }): Promise<User> {
    const passwordHash = await this.hashPassword(userData.password);
    
    return this.create({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase().trim(),
      passwordHash,
      role: userData.role || 'patient',
      dob: userData.dob,
      phoneNumber: userData.phoneNumber,
      consentGivenAt: new Date(), // Record consent when user signs up
    });
  }

  public static async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { email: email.toLowerCase().trim() }
    });
  }
}

// Initialize the model
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [1, 255],
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 20],
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('patient', 'doctor', 'admin'),
      allowNull: false,
      defaultValue: 'patient',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    consentGivenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    emergencyContact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
  }
);