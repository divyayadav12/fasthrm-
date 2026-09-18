import cron from 'node-cron';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';
import User from '../models/User';
import { io } from '../index';

export const startShiftCronJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const istTimeMs = now.getTime() + (5.5 * 60 * 60 * 1000);
      const istDate = new Date(istTimeMs);
      
      const hours = String(istDate.getUTCHours()).padStart(2, '0');
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
      const istTime = `${hours}:${minutes}`;
      
      const users = await User.find({ officeEndTime: { $exists: true, $ne: '' } });

      for (const user of users) {
        const workingTasks = await Task.find({ assignedTo: user._id, status: 'WORKING' });
        
        for (const task of workingTasks) {
          if (!task.startedAt) continue;

          const taskStart = new Date(task.startedAt);
          const taskStartIST = new Date(taskStart.getTime() + (5.5 * 60 * 60 * 1000));
          const startHours = String(taskStartIST.getUTCHours()).padStart(2, '0');
          const startMins = String(taskStartIST.getUTCMinutes()).padStart(2, '0');
          const taskStartTimeStr = `${startHours}:${startMins}`;

          const isDifferentDay = istDate.toDateString() !== taskStartIST.toDateString();
          const missedToday = istTime >= user.officeEndTime! && taskStartTimeStr <= user.officeEndTime!;

          if (isDifferentDay || missedToday) {
            const elapsed = Math.max(1, Math.round((Date.now() - taskStart.getTime()) / 60000));

            task.totalDuration = (task.totalDuration || 0) + elapsed;
            task.status = 'PENDING';
            task.startedAt = undefined;
            await task.save();

            const newLog = await WorkLog.create({
              employeeId: user._id,
              projectId: task.projectId,
              taskId: task._id,
              customTaskTitle: task.title,
              status: 'PENDING',
              progress: task.progress || 0,
              description: 'Auto-paused: Shift Ended',
              startTime: new Date(Date.now() - elapsed * 60000),
              endTime: new Date(),
              duration: elapsed,
            });

            const populatedLog = await WorkLog.findById(newLog._id)
              .populate('employeeId', 'name email department designation role profileImage')
              .populate('projectId', 'name')
              .populate('taskId', 'title description status progress');

            io.emit('worklog_updated', populatedLog);
          }
        }
      }
    } catch (error) {
      console.error('Error in shift auto-pause cron job:', error);
    }
  });
};
