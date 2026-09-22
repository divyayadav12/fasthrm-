import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.connection.collection('users');
  const Task = mongoose.connection.collection('tasks');
  const WorkLog = mongoose.connection.collection('worklogs');
  
  const divya = await User.findOne({ name: /Divya/i });
  
  const d = new Date(); d.setHours(0, 0, 0, 0);
  
  // Aggregate just like reports.controller.ts
  const tasks = await Task.find({ assignedTo: divya._id }).sort({ updatedAt: -1 }).toArray();
  const taskIds = tasks.map((t) => t._id);
  
  const latestLogPerTask = await WorkLog.aggregate([
    {
      $match: {
        employeeId: divya._id,
        taskId: { $in: taskIds },
        createdAt: { $gte: d }
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$taskId',
        lastActivity: { $first: '$createdAt' },
        logCount: { $sum: 1 },
        filteredDuration: { $sum: { $ifNull: ['$duration', 0] } }
      },
    },
  ]).toArray();
  
  console.log('Today WorkLogs aggregation:');
  for (const entry of latestLogPerTask) {
     const t = tasks.find(x => x._id.toString() === entry._id.toString());
     console.log(`- Task: ${t?.title}`);
     console.log(`  Filtered Duration: ${entry.filteredDuration}m`);
  }
  process.exit(0);
});
