import express from 'express';
import { loginUser, logoutUser, getCurrentUser, registerUser } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import User from '../models/User';
import bcrypt from 'bcryptjs';

const router = express.Router();



router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getCurrentUser);

export default router;
