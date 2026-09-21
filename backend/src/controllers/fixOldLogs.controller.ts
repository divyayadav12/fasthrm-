import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';

export const fixOldLogs = async (req: Request, res: Response) => {
  try {
    const logs = await WorkLog.find({});
    let fixedCount = 0;
    for (const log of logs) {
      if (log.startTime && log.endTime) {
         const dur = Math.max(1, Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 60000));
         if (log.duration !== dur) {
            log.duration = dur;
            await log.save();
            fixedCount++;
         }
      } else if (!log.endTime && log.status !== 'WORKING') {
         // Some logs might not have endTime? 
         // If it's a "Started Lunch Break" log, it has no endTime, and status is WORKING.
         // Wait, the 1:12 PM log is "WORKING" but has duration 30m. It should be duration 0m or live.
         // Actually, if it's WORKING, it should have 0 duration in the DB because it's live!
         if (log.duration && log.duration > 0) {
            log.duration = 0;
            await log.save();
            fixedCount++;
         }
      }
    }
    res.json({ message: `Fixed ${fixedCount} logs duration` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
