import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Task from './src/models/Task.js';
import WorkLog from './src/models/WorkLog.js';

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const tasks = await Task.find({ title: /Lunch Break/i });
  let fixed = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const t of tasks) {
    const logs = await WorkLog.find({ taskId: t._id, createdAt: { $gte: today } });
    let todayDur = 0;
    for (const l of logs) {
      if (l.duration) todayDur += l.duration;
    }
    t.totalDuration = todayDur;
    await t.save();
    fixed++;
  }
  console.log('Fixed', fixed, 'Lunch Break tasks');
  process.exit(0);
});
