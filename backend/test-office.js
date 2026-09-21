import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.connection.collection('users');
  const users = await User.find({ name: { $in: [/Jyoti/i, /Divya/i, /Neha/i, /Aakansha/i] } }).toArray();
  for (const u of users) {
    console.log(u.name, u.officeEndTime);
  }
  process.exit(0);
});
