import express from 'express';
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  registerUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getResetRequests,
} from '../controllers/auth.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import User from '../models/User';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/clean-users', async (req, res) => {
  try {
    const result = await User.deleteMany({
      $or: [
        { name: { $exists: false } },
        { name: null },
        { name: '' }
      ]
    });
    res.json({ message: 'Deleted unknown users successfully', deletedCount: result.deletedCount });
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
router.get('/reset-requests', protect, adminOnly, getResetRequests);

export default router;

