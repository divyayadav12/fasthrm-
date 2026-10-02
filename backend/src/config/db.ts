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

      const User = (await import('../models/User')).default;
      const WorkLog = (await import('../models/WorkLog')).default;
      const Task = (await import('../models/Task')).default;

      // Find Unknown users
      const unknownUsers = await User.find({
        $or: [
          { name: { $regex: /^unknown$/i } },
          { name: { $exists: false } },
          { name: null },
          { name: '' },
          { email: { $regex: /^unknown/i } }
        ]
      });

      const unknownUserIds = unknownUsers.map(u => u._id);
      if (unknownUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: unknownUserIds } });
        console.log(`Deleted ${unknownUserIds.length} unknown users from DB`);
      }

      // Valid users
      const validUsers = await User.find({}).select('_id');
      const validUserIds = validUsers.map(u => u._id);

      // Delete orphaned worklogs
      await WorkLog.deleteMany({
        $or: [
          { employeeId: { $in: unknownUserIds } },
          { employeeId: { $nin: validUserIds } },
          { employeeId: null },
          { employeeId: { $exists: false } },
          { customTaskTitle: { $regex: /^unknown$/i } }
        ]
      });

      // Delete orphaned tasks
      await Task.deleteMany({
        $or: [
          { assignedTo: { $in: unknownUserIds } },
          { assignedTo: { $nin: validUserIds } },
          { assignedTo: null },
          { assignedTo: { $exists: false } }
        ]
      });
      console.log('Cleaned up unknown users and orphaned worklogs/tasks');

      // Update specific users to "Others" department as requested
      const othersResult = await User.updateMany(
        {
          $or: [
            { name: { $regex: /abhiwak/i } },
            { name: { $regex: /mahima/i } },
            { name: { $regex: /harshu/i } },
            { name: { $regex: /akansha|akanksha|aakanksha/i } },
            { email: { $regex: /abhiwak|mahima|harshu|akansha|akanksha|aakanksha/i } }
          ]
        },
        {
          $set: {
            department: 'Others',
            designation: 'Others'
          }
        }
      );
      console.log(`Updated Abhiwak, Mahima, Harshu, Akansha to department Others (matched: ${othersResult.matchedCount}, modified: ${othersResult.modifiedCount})`);
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
