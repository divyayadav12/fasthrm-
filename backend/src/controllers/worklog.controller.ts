import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';
import Task from '../models/Task';
import { io } from '../index';

// @desc    Create new work log (Permanent history)
// @route   POST /api/work-logs
// @access  Private
export const createWorkLog = async (req: Request, res: Response) => {
  try {
    const { projectId, taskId, customTaskTitle, status, progress, description, startTime, endTime, duration } = req.body;
    const employeeId = (req as any).user._id;

    let finalTaskId = taskId;
    if (customTaskTitle) {
      let task = await Task.findOne({ title: customTaskTitle, assignedTo: employeeId });
      if (!task) {
        task = await Task.create({
          title: customTaskTitle,
          assignedTo: employeeId,
          status,
          progress,
          description,
          completedAt: status === 'COMPLETED' ? new Date() : undefined
        });
      } else {
        task.status = status;
        task.progress = progress;
        if (status === 'COMPLETED') {
          task.completedAt = new Date();
        }
        await task.save();
      }
      finalTaskId = task._id;
    } else if (taskId) {
      await Task.findByIdAndUpdate(taskId, {
        status,
        progress,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {})
      });
    }

    const workLog = await WorkLog.create({
      employeeId,
      projectId,
      taskId: finalTaskId,
      customTaskTitle,
      status,
      progress,
      description,
      startTime,
      endTime,
      duration,
    });

    // Populate for socket event
    const populatedLog = await WorkLog.findById(workLog._id)
      .populate('employeeId', 'name email department designation role profileImage')
      .populate('projectId', 'name')
      .populate('taskId', 'title');

    // Emit socket event for real-time dashboard update
    io.emit('worklog_updated', populatedLog);

    res.status(201).json(populatedLog);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all work logs (with filters for Admin)
// @route   GET /api/work-logs
// @access  Private/Admin
export const getWorkLogs = async (req: Request, res: Response) => {
  try {
    const { employeeId, projectId, taskId, status, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const query: any = {};

    if (employeeId) query.employeeId = employeeId;
    if (projectId) query.projectId = projectId;
    if (taskId) query.taskId = taskId;
    if (status) query.status = status;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const startIndex = (pageNumber - 1) * limitNumber;

    const total = await WorkLog.countDocuments(query);
    const workLogs = await WorkLog.find(query)
      .populate('employeeId', 'name email department designation role profileImage')
      .populate('projectId', 'name')
      .populate('taskId', 'title')
      .skip(startIndex)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    res.json({
      workLogs,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      total,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get work logs by employee ID (Employee viewing own history or Admin viewing specific)
// @route   GET /api/work-logs/employee/:employeeId
// @access  Private
export const getEmployeeWorkLogs = async (req: Request, res: Response) => {
  try {
    // Only admin or the employee themselves can view their history
    const reqUser = (req as any).user;
    if (reqUser.role === 'EMPLOYEE' && reqUser._id.toString() !== req.params.employeeId) {
      return res.status(403).json({ message: 'Not authorized to view other employee history' });
    }

    const { projectId, status, dateFrom, dateTo, page = '1', limit = '100' } = req.query;
    const query: any = { employeeId: req.params.employeeId };

    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const startIndex = (pageNumber - 1) * limitNumber;

    const total = await WorkLog.countDocuments(query);
    const workLogs = await WorkLog.find(query)
      .populate('employeeId', 'name email department designation profileImage')
      .populate('projectId', 'name')
      .populate('taskId', 'title description status')
      .skip(startIndex)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    res.json({
      workLogs,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      total,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all work logs for a specific task
// @route   GET /api/work-logs/task/:taskId
// @access  Private
export const getTaskWorkLogs = async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params.taskId || '');
    let query: any = {};

    const isValidId = /^[0-9a-fA-F]{24}$/.test(taskId);
    if (isValidId) {
      query = {
        $or: [
          { taskId },
          { _id: taskId }
        ]
      };
    } else {
      query = {
        customTaskTitle: decodeURIComponent(taskId)
      };
    }

    const workLogs = await WorkLog.find(query)
      .populate('employeeId', 'name email department designation profileImage')
      .populate('projectId', 'name')
      .populate('taskId', 'title description status assignedTo')
      .sort({ createdAt: -1 });

    res.json({
      workLogs,
      total: workLogs.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a work log
// @route   DELETE /api/work-logs/:id
// @access  Private
export const deleteWorkLog = async (req: Request, res: Response) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Work log not found' });

    const user = (req as any).user;
    const isOwner = log.employeeId && log.employeeId.toString() === user._id.toString();
    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this work log' });
    }

    await WorkLog.findByIdAndDelete(req.params.id);
    io.emit('worklog_updated', { _id: null, deletedLogId: log._id });

    res.json({ message: 'Work log removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
