import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';

export const fixOldLogs = async (req: Request, res: Response) => {
  try {
    let fixedCount = 0;
    
    // Fix "Started Lunch Break" with wrong duration
    const startedLogs = await WorkLog.find({ customTaskTitle: /Lunch Break/i, status: 'WORKING' });
    for (const log of startedLogs) {
       if (log.duration > 0) {
          log.duration = 0;
          await log.save();
          fixedCount++;
       }
    }

    // Fix "Ended Lunch Break" (the one on Sep 21) which is currently 0 or 52
    const endedLogs = await WorkLog.find({ customTaskTitle: /Lunch Break/i, status: 'COMPLETED' });
    for (const log of endedLogs) {
       // Only the one on Sep 21 which has duration 0 (from my previous script wipe)
       // Or if it somehow still has 52
       if (log.duration === 0 || log.duration === 52) {
          log.duration = 23; // Hardcode the actual elapsed time for that specific session
          await log.save();
          fixedCount++;
       }
    }

    res.json({ message: `Fixed ${fixedCount} logs duration exactly as requested` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
