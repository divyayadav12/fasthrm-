import express from 'express';
import { createWorkLog, getWorkLogs, getEmployeeWorkLogs, getTaskWorkLogs } from '../controllers/worklog.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.route('/')
  .post(protect, createWorkLog)
  .get(protect, adminOnly, getWorkLogs);

router.route('/employee/:employeeId')
  .get(protect, getEmployeeWorkLogs);

router.route('/task/:taskId')
  .get(protect, getTaskWorkLogs);

export default router;
