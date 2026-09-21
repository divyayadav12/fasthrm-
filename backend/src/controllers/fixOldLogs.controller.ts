import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';

export const fixAllLogs = async (req: Request, res: Response) => {
  try {
    const logs = await WorkLog.find({}).sort({ createdAt: 1 });
    let fixedCount = 0;

    // Group logs by employee + task
    const groups: { [key: string]: any[] } = {};
    for (const log of logs) {
      const key = `${log.employeeId}_${log.taskId || log.customTaskTitle}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    }

    for (const key in groups) {
      const taskLogs = groups[key];
      let lastWorkingTime: Date | null = null;

      for (const log of taskLogs) {
        let expectedDuration = 0;

        if (log.status === 'WORKING') {
           lastWorkingTime = new Date(log.startTime || log.createdAt);
           expectedDuration = 0;
        } else {
           if (lastWorkingTime) {
              const endTime = new Date(log.createdAt);
              expectedDuration = Math.max(1, Math.round((endTime.getTime() - lastWorkingTime.getTime()) / 60000));
           } else {
              expectedDuration = 0;
           }
           lastWorkingTime = null; // Reset until they start working again
        }

        if (log.duration !== expectedDuration) {
           log.duration = expectedDuration;
           await log.save();
           fixedCount++;
        }
      }
    }

    res.json({ message: `Successfully recalculated and fixed ${fixedCount} logs based on timeline history!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
