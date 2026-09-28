import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { dispatchDailyWorkReport } from './jobs/dailyReportCron';

async function sendNow() {
  try {
    console.log('Connecting to database with Google DNS resolver...');
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB successfully.');

    console.log('Sending Daily Work Report email with PDF to esarthak@gmail.com & divyayadav141203@gmail.com...');
    const result = await dispatchDailyWorkReport();
    console.log('✅ Email dispatch result:', JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed to send email:', err);
    process.exit(1);
  }
}

sendNow();
