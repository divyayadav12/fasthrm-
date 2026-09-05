import express from 'express';
import { getEmployeeReport, getProjectReport, getProductivityStats } from '../controllers/reports.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/employee', protect, adminOnly, getEmployeeReport);
router.get('/project', protect, adminOnly, getProjectReport);
router.get('/productivity', protect, adminOnly, getProductivityStats);

export default router;
