import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const WorkLog = mongoose.connection.collection('worklogs');
  const logs = await WorkLog.find({ customTaskTitle: /content researching/i }).toArray();
  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
});
