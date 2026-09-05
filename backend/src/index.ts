import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db';
import { notFound, errorHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import worklogRoutes from './routes/worklog.routes';
import reportsRoutes from './routes/reports.routes';
import notificationRoutes from './routes/notification.routes';

dotenv.config();

connectDB();

const app = express();
const httpServer = createServer(app);

// Socket.io setup
export const io = new Server(httpServer, {
  cors: {
    origin: '*', // Set to frontend URL in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('WorkPulse API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/work-logs', worklogRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
