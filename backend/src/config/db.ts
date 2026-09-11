import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workpulse');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    try {
      const Notification = (await import('../models/Notification')).default;
      await Notification.deleteMany({
        $or: [
          { title: { $regex: /Password Reset/i } },
          { message: { $regex: /password reset/i } }
        ]
      });
    } catch (e) {
      console.error('Error cleaning up reset notifications:', e);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
