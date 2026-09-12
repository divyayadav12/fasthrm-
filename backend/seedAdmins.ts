import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import connectDB from './src/config/db';

dotenv.config();

const seedAdmins = async () => {
  await connectDB();
  
  const admins = [
    {
      name: 'Ritesh Sir',
      email: 'linkritesh@gmail.com',
      password: 'Fast@123',
      role: 'ADMIN',
      adminScope: 'ONLY_FAST_CAREERS',
      isActive: true
    },
    {
      name: 'Pravin Sir',
      email: 'fast.pravinjain@gmail.com',
      password: 'Fast@123',
      role: 'ADMIN',
      adminScope: 'EXCLUDE_FAST_CAREERS',
      isActive: true
    }
  ];

  for (const adminData of admins) {
    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      existing.adminScope = adminData.adminScope as any;
      existing.role = adminData.role as any;
      
      // Update password if necessary
      existing.password = adminData.password;
      
      await existing.save();
      console.log(`Updated existing admin: ${adminData.email}`);
    } else {
      await User.create(adminData);
      console.log(`Created new admin: ${adminData.email}`);
    }
  }

  process.exit();
};

seedAdmins();
