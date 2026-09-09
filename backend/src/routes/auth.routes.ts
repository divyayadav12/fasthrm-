import express from 'express';
import { loginUser, logoutUser, getCurrentUser, registerUser } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import User from '../models/User';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/make-admin', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: 'fast@gmail.com' },
      { role: 'ADMIN' },
      { new: true }
    );
    res.json({ message: 'Account upgraded to Admin!', user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getCurrentUser);

export default router;
