import mongoose from 'mongoose';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';
import { io } from '../index';
import { checkOfficeHours } from '../utils/officeHours';

export const setupAutoPauseCron = () => {
  // Run every 1 minute
  setInterval(async () => {
    try {
      // If outside office hours, pause all WORKING tasks
      if (!checkOfficeHours()) {
        const workingTasks = await Task.find({ status: 'WORKING' });
        if (workingTasks.length === 0) return;

        console.log(\[CRON] Outside office hours. Auto-pausing \ running tasks...\);

        for (const task of workingTasks) {
          const elapsed = task.startedAt
            ? Math.max(1, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000))
            : 0;

          task.totalDuration = (task.totalDuration || 0) + elapsed;
          task.status = 'PENDING';
          task.startedAt = undefined;
          await task.save();

          await WorkLog.create({
            employeeId: task.assignedTo,
            projectId: task.projectId,
            taskId: task._id,
            customTaskTitle: task.title,
            status: 'PENDING',
            progress: task.progress || 0,
            description: 'System Auto-Paused: Shift Ended (7:00 PM)',
            startTime: new Date(Date.now() - elapsed * 60000),
            endTime: new Date(),
            duration: elapsed,
          });

          io.emit('worklog_updated', { _id: null, updatedTaskId: task._id.toString() });
        }
      }
    } catch (err) {
      console.error('[CRON] Error during auto-pause:', err);
    }
  }, 60 * 1000);
};
