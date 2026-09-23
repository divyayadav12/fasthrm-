import express from 'express';
import WorkLog from '../models/WorkLog';
import { fixOldLogs } from '../controllers/fixOldLogs.controller';
const router = express.Router();
router.get('/test-logs', async (req, res) => {
  const logs = await WorkLog.find({ customTaskTitle: /working on career app/i }).sort({ createdAt: -1 });
  res.json(logs.map(l => ({ status: l.status, duration: l.duration, title: l.customTaskTitle, createdAt: (l as any).createdAt })));
});
router.get('/fix-desc', async (req, res) => {
  await WorkLog.updateMany({ description: 'Resumed after lunch' }, { $set: { description: 'working on career app' } });
  res.json({ message: 'Fixed descriptions' });
});
router.get('/fix-old-logs', fixOldLogs);
export default router;
