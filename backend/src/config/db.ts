import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  if (env.DATABASE_URL) {
    try {
      await mongoose.connect(env.DATABASE_URL);
      console.log('Connected to MongoDB database.');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
}

export const connectDatabase = connectDB;
export default connectDB;
