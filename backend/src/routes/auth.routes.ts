import express from 'express';
import { loginUser, logoutUser, getCurrentUser, registerUser } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
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

export default router;
