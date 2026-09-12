import express from 'express';
import { getEmployeeReport, getProjectReport, getProductivityStats, getMyTaskReport } from '../controllers/reports.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/employee', protect, adminOnly, getEmployeeReport);
router.get('/project', protect, adminOnly, getProjectReport);
router.get('/productivity', protect, adminOnly, getProductivityStats);

// Employee self-report — no adminOnly — employee can see their OWN task time breakdown
router.get('/my-tasks', protect, getMyTaskReport);

export default router;
