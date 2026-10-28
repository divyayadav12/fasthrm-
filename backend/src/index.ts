import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db';
import { notFound, errorHandler } from './middleware/error.middleware';

import { startShiftCronJob } from './jobs/shiftAutoPause';
import { startDailyReportCronJob } from './jobs/dailyReportCron';
startShiftCronJob();
startDailyReportCronJob();

import debugRoutes from './routes/debug.routes';
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import worklogRoutes from './routes/worklog.routes';
import reportsRoutes from './routes/reports.routes';
import notificationRoutes from './routes/notification.routes';
import leaveRoutes from './routes/leave.routes';
import studentInquiryRoutes from './routes/studentInquiry.routes';

dotenv.config();

connectDB();

const app = express();
const httpServer = createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'https://hrm.coachingfast.in',
  'http://hrm.coachingfast.in',
  'http://localhost:3000',
  'http://localhost:5173',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Socket.io setup
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests
app.use(express.json());

app.get('/', (req, res) => {
  res.send('WorkPulse API is running...');
});

app.use('/api/debug', debugRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/work-logs', worklogRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/student-inquiries', studentInquiryRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

  // Self-ping to prevent Render Free tier from sleeping
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://fasthrm.onrender.com';
  setInterval(() => {
    try {
      const https = require('https');
      const http = require('http');
      const client = RENDER_EXTERNAL_URL.startsWith('https') ? https : http;
      client.get(RENDER_EXTERNAL_URL, (res: any) => {
        console.log(`[Keep-Alive Ping] Status: ${res.statusCode}`);
      }).on('error', (err: any) => {
        console.log('[Keep-Alive Ping Error]:', err.message);
      });
    } catch (e) {
      // ignore
    }
  }, 10 * 60 * 1000); // Ping every 10 minutes
});


