import express from 'express';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';

const router = express.Router();

router.get('/reset-lunch', async (req, res) => {
  const tasks = await Task.find({ title: /Lunch Break/i });
  let fixed = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const t of tasks) {
    const logs = await WorkLog.find({ taskId: t._id, createdAt: { $gte: today } });
    let dur = 0;
    for (const l of logs) dur += (l.duration || 0);
    t.totalDuration = dur;
    await t.save();
    fixed++;
  }
  res.json({ message: 'Fixed ' + fixed + ' lunch breaks' });
});
export default router;
