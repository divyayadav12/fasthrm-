import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fixOldLogs } from './src/controllers/fixOldLogs.controller.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const req = {} as any;
  const res = {
    json: (data: any) => console.log('Result:', data),
    status: (code: number) => ({ json: (data: any) => console.log('Error', code, data) })
  } as any;
  
  await fixOldLogs(req, res);
  process.exit(0);
});
