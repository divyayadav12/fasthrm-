import express from 'express';
import WorkLog from '../models/WorkLog';
import Task from '../models/Task';

const router = express.Router();

router.get('/debug-report', async (req, res) => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const logs = await WorkLog.aggregate([
    { $match: { createdAt: { $gte: d } } },
    { $group: { _id: '$taskId', dur: { $sum: { $ifNull: ['$duration', 0] } }, count: { $sum: 1 }, items: { $push: { status: '$status', duration: '$duration' } } } }
  ]);
  const result = [];
  for (const l of logs) {
    const t = await Task.findById(l._id);
    result.push({ title: t?.title, dur: l.dur, items: l.items });
  }
  res.json(result);
});
export default router;
