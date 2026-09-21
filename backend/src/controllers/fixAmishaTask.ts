import { Request, Response } from 'express';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';
import User from '../models/User';

export const fixAmishaTask = async (req: Request, res: Response) => {
  try {
    const shailendra = await User.findOne({ name: /Shailendra/i });
    if (!shailendra) return res.status(404).json({ error: 'Shailendra not found' });

    const task = await Task.findOne({ title: /CA Foundation Chapter/i, assignedTo: shailendra._id, status: 'WORKING' });
    if (task) {
      task.status = 'PENDING';
      task.startedAt = undefined;
      await task.save();

      const lastLog = await WorkLog.findOne({ taskId: task._id, status: 'WORKING' }).sort({ createdAt: -1 });
      if (lastLog) {
        lastLog.status = 'PENDING';
        lastLog.description = 'Auto-paused to Pending as employee left';
        lastLog.duration = 0;
        await lastLog.save();
      }
      res.json({ message: 'Task successfully set to PENDING and time stopped.' });
    } else {
      res.json({ message: 'Task was not in WORKING state or not found.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
