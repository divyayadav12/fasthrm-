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
router.get('/all-users', async (req, res) => {
  const User = (await import('../models/User')).default;
  const users = await User.find({}).select('name email role department designation isActive');
  res.json({ total: users.length, users });
});
router.get('/all-recent-activity', async (req, res) => {
  const Task = (await import('../models/Task')).default;
  const [tasks, logs] = await Promise.all([
    Task.find({}).populate('assignedTo', 'name email department').sort({ updatedAt: -1 }).limit(100),
    WorkLog.find({}).populate('employeeId', 'name email department').populate('taskId', 'title').sort({ createdAt: -1 }).limit(100),
  ]);
  res.json({
    totalTasks: tasks.length,
    tasks: tasks.map(t => ({ title: t.title, assignedTo: (t.assignedTo as any)?.name, status: t.status, totalDuration: t.totalDuration, updatedAt: (t as any).updatedAt })),
    totalLogs: logs.length,
    logs: logs.map(l => ({ employee: (l.employeeId as any)?.name, task: (l.taskId as any)?.title || l.customTaskTitle, status: l.status, duration: l.duration, desc: l.description, createdAt: (l as any).createdAt })),
  });
});
router.get('/fix-old-logs', fixOldLogs);
export default router;
