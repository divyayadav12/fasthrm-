import express from 'express';
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  registerUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from '../controllers/auth.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import User from '../models/User';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/clean-users', async (req, res) => {
  try {
    const WorkLog = (await import('../models/WorkLog')).default;
    const Task = (await import('../models/Task')).default;

    // 1. Find Unknown users
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

    // Delete Unknown users
    let deletedUsersCount = 0;
    if (unknownUserIds.length > 0) {
      const userDel = await User.deleteMany({ _id: { $in: unknownUserIds } });
      deletedUsersCount = userDel.deletedCount;
    }

    // Get all currently remaining valid users
    const validUsers = await User.find({}).select('_id');
    const validUserIds = validUsers.map(u => u._id);

    // 2. Delete all worklogs tied to unknown or non-existent users
    const workLogDel = await WorkLog.deleteMany({
      $or: [
        { employeeId: { $in: unknownUserIds } },
        { employeeId: { $nin: validUserIds } },
        { employeeId: null },
        { employeeId: { $exists: false } },
        { customTaskTitle: { $regex: /^unknown$/i } }
      ]
    });

    // 3. Delete all tasks tied to unknown or non-existent users
    const taskDel = await Task.deleteMany({
      $or: [
        { assignedTo: { $in: unknownUserIds } },
        { assignedTo: { $nin: validUserIds } },
        { assignedTo: null },
        { assignedTo: { $exists: false } }
      ]
    });

    res.json({
      message: 'Unknown user and associated records deleted successfully',
      deletedUsersCount,
      deletedWorkLogsCount: workLogDel.deletedCount,
      deletedTasksCount: taskDel.deletedCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getCurrentUser);

// Password Reset Routes
router.get('/test-email', async (req, res) => {
  try {
    const { sendEmail } = await import('../utils/sendEmail');
    const result = await sendEmail({
      to: 'divyayadav141203@gmail.com',
      subject: 'Fast HRM Test Email',
      text: 'This is a test email from Render backend.',
    });
    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

router.get('/clean-reset-notifications', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification')).default;
    const result = await Notification.deleteMany({
      $or: [
        { title: { $regex: /Password Reset/i } },
        { message: { $regex: /password reset/i } }
      ]
    });
    res.json({ message: 'Reset notifications purged successfully', deletedCount: result.deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

