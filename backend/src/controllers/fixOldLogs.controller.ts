import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';

export const fixOldLogs = async (req: Request, res: Response) => {
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
      let lastWorkingLog: any = null;

      for (const log of taskLogs) {
        if (log.status === 'WORKING') {
           lastWorkingLog = log;
           log.duration = 0; // Temporary until we find the end
           await log.save();
        } else {
           if (lastWorkingLog) {
              const startTime = new Date(lastWorkingLog.startTime || lastWorkingLog.createdAt);
              const endTime = new Date(log.createdAt);
              const gap = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
              
              lastWorkingLog.duration = gap;
              lastWorkingLog.endTime = endTime;
              await lastWorkingLog.save();
              fixedCount++;
           }
           lastWorkingLog = null;
           
           if (log.duration !== 0) {
              log.duration = 0;
              await log.save();
              fixedCount++;
           }
        }
      }
    }

    res.json({ message: `Successfully recalculated and fixed ${fixedCount} logs based on timeline history!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
