import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (env.DATABASE_URL) {
    try {
      await mongoose.connect(env.DATABASE_URL);
      console.log('Connected to MongoDB database.');

      // Migration safeguard: ensure pre-existing Admin accounts have approvalStatus: 'approved'
      if (mongoose.models.User) {
        await mongoose.models.User.updateMany(
          { role: 'admin', approvalStatus: { $in: [null, undefined] } },
          { $set: { approvalStatus: 'approved', approvedAt: new Date() } },
        ).exec().catch(() => null);
      }
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
}

export const connectDatabase = connectDB;
export default connectDB;
