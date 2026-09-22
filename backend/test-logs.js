import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.connection.collection('users');
  const WorkLog = mongoose.connection.collection('worklogs');
  
  const divya = await User.findOne({ name: /Divya/i });
  
  const d = new Date(); 
  d.setHours(0, 0, 0, 0); // local midnight
  
  const logs = await WorkLog.find({ 
    employeeId: divya._id,
    createdAt: { $gte: d }
  }).toArray();
  
  let totalDuration = 0;
  for (const log of logs) {
    if (log.customTaskTitle?.includes('Lunch Break')) {
      console.log('Lunch Break Log:', log.createdAt, log.duration);
      totalDuration += (log.duration || 0);
    }
  }
  console.log('Total Lunch Break duration today:', totalDuration);
  process.exit(0);
});
