import express from 'express';
import { loginUser, logoutUser, getCurrentUser, registerUser } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import User from '../models/User';
import bcrypt from 'bcryptjs';

const router = express.Router();

router.get('/seed', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const admin = await User.create({
      name: 'Admin User',
      email: 'fast@gmail.com',
      password: hashedPassword,
      role: 'ADMIN',
      department: 'Management',
    });
    res.json({ message: 'Admin seeded successfully', admin });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getCurrentUser);

export default router;
