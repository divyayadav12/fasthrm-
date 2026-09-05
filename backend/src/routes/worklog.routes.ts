import express from 'express';
import { createWorkLog, getWorkLogs, getEmployeeWorkLogs } from '../controllers/worklog.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.route('/')
  .post(protect, createWorkLog)
  .get(protect, adminOnly, getWorkLogs);

router.route('/employee/:employeeId')
  .get(protect, getEmployeeWorkLogs);

export default router;
