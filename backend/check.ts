import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const WorkLog = mongoose.connection.collection("worklogs");
  const logs = await WorkLog.find({ customTaskTitle: /working on career app/i }).sort({ createdAt: -1 }).toArray();
  console.log(logs.map(l => ({ status: l.status, duration: l.duration, time: l.createdAt })));
  process.exit(0);
});
