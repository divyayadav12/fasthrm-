import express from 'express';
import WorkLog from '../models/WorkLog';
import { fixOldLogs } from '../controllers/fixOldLogs.controller';
const router = express.Router();
router.get('/test-logs', async (req, res) => {
  const logs = await WorkLog.find({ customTaskTitle: /working on career app/i }).sort({ createdAt: -1 });
  res.json(logs.map(l => ({ status: l.status, duration: l.duration, title: l.customTaskTitle, createdAt: (l as any).createdAt })));
});
router.get('/fix-old-logs', fixOldLogs);
export default router;
