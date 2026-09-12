import express from 'express';
import { applyLeave, getMyLeaves, getAllLeaves, updateLeaveStatus } from '../controllers/leave.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/apply', protect, applyLeave);
router.get('/my', protect, getMyLeaves);
router.get('/', protect, adminOnly, getAllLeaves);
router.put('/:id/status', protect, adminOnly, updateLeaveStatus);

export default router;
