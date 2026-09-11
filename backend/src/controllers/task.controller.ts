import { Request, Response } from 'express';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';
import { io } from '../index';
import { syncTaskTimingOnStatusChange } from './worklog.controller';

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req: Request, res: Response) => {
  try {
    const { projectId, assignedTo, status } = req.query;
    const query: any = {};
    
    if (projectId) query.projectId = projectId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate('projectId', 'name status')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });
      
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
export const getTaskById = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name status')
      .populate('assignedTo', 'name email');
      
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create task
// @route   POST /api/tasks
// @access  Private/Admin
export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, projectId, assignedTo, priority, deadline } = req.body;
    
    const task = await Task.create({
      title,
      description,
      projectId,
      assignedTo,
      priority,
      deadline,
    });
    
    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req: Request, res: Response) => {
  try {
    const { status, progress, description, restartReason, title, priority, deadline } = req.body;
    
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (restartReason !== undefined) task.restartReason = restartReason;
    if (priority) task.priority = priority;
    if (deadline !== undefined) task.deadline = deadline;
    if (progress !== undefined) task.progress = Number(progress);

    if (status) {
      await syncTaskTimingOnStatusChange(task, status, task.assignedTo);
    }

    await task.save();

    // Notify connected dashboards in real-time
    io.emit('worklog_updated', { _id: null, updatedTaskId: task._id });
    
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const user = (req as any).user;
    const isOwner = task.assignedTo && task.assignedTo.toString() === user._id.toString();
    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }

    await Task.findByIdAndDelete(req.params.id);

    // Delete associated worklogs
    await WorkLog.deleteMany({
      $or: [
        { taskId: task._id },
        { customTaskTitle: task.title, employeeId: task.assignedTo }
      ]
    });

    // Notify connected dashboards in real-time
    io.emit('worklog_updated', { _id: null, deletedTaskId: task._id });

    res.json({ message: 'Task and associated records removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
