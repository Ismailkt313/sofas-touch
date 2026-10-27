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

      if (mongoose.models.User) {
        await mongoose.models.User.updateMany(
          { role: { $in: ['admin', 'Admin'] }, approvalStatus: { $in: [null, undefined] } },
          { $set: { approvalStatus: 'approved', approvedAt: new Date() } },
        ).exec().catch(() => null);

        await mongoose.models.User.updateMany(
          { role: { $in: ['data_entry', 'Data Entry'] }, approvalStatus: { $in: [null, undefined] } },
          { $set: { approvalStatus: 'approved', approvedAt: new Date() } },
        ).exec().catch(() => null);

        const count = await mongoose.models.User.countDocuments().exec().catch(() => 0);
        if (count === 0) {
          const { sharedUserMemoryStore, seedSharedUserMemoryStore } = await import(
            '../modules/auth/models/user.model'
          );
          seedSharedUserMemoryStore();
          const seedUsers = Array.from(sharedUserMemoryStore.values()).map(
            (u) => ({
              ...u,
              _id: new mongoose.Types.ObjectId(),
            }),
          );
          await mongoose.models.User.insertMany(seedUsers).catch(() => null);
        }
      }

      const projectModels = [
        mongoose.models.Project,
        mongoose.models.ProjectCounter,
        mongoose.models.ProjectCostAlert,
        mongoose.models.ProjectActivityWarning,
      ].filter(Boolean);

      await Promise.all(
        projectModels.map((model) => model.createIndexes().catch(() => null)),
      );
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
}

export const connectDatabase = connectDB;
export default connectDB;
