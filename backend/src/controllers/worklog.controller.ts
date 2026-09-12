import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';
import Task from '../models/Task';
import { io } from '../index';

/**
 * Ensures an employee has only ONE actively 'WORKING' task at a time,
 * accumulates accurate durations (in minutes), and auto-resumes pending tasks upon completion.
 *
 * IMPORTANT: This function does NOT call io.emit for the COMPLETED→auto-resume case.
 * Instead it returns the auto-resumed task id so the CALLER can emit AFTER saving the
 * main task — preventing a race condition where the frontend re-fetches before the
 * completing task is persisted as COMPLETED in the DB.
 *
 * Returns { autoResumedTaskId } if a PENDING task was auto-resumed to WORKING.
 */
export const syncTaskTimingOnStatusChange = async (
  task: any,
  newStatus: string,
  employeeId: any,
  manualDuration?: number
): Promise<{ autoResumedTaskId?: string }> => {
  const empId = employeeId?._id || employeeId || task.assignedTo;

  if (newStatus === 'WORKING') {
    // 1. Shift ALL OTHER currently 'WORKING' tasks for this employee to 'PENDING'
    const otherWorkingTasks = await Task.find({
      assignedTo: empId,
      status: 'WORKING',
      _id: { $ne: task._id },
    });

    for (const other of otherWorkingTasks) {
      const elapsed = other.startedAt
        ? Math.max(1, Math.round((Date.now() - new Date(other.startedAt).getTime()) / 60000))
        : 0;

      other.totalDuration = (other.totalDuration || 0) + elapsed;
      other.status = 'PENDING';
      other.startedAt = undefined;
      await other.save();

      // Log the transition to PENDING in WorkLog history
      await WorkLog.create({
        employeeId: empId,
        projectId: other.projectId,
        taskId: other._id,
        customTaskTitle: other.title,
        status: 'PENDING',
        progress: other.progress || 0,
        description: 'Auto-paused to Pending as another task was started',
        startTime: new Date(Date.now() - elapsed * 60000),
        endTime: new Date(),
        duration: elapsed,
      });

      // Emit real-time notification for the paused task
      io.emit('worklog_updated', { _id: null, updatedTaskId: other._id });
    }

    // 2. Set this task as actively working with startedAt now
    if (task.status !== 'WORKING' || !task.startedAt) {
      task.startedAt = new Date();
    }
    if (manualDuration && Number(manualDuration) > 0) {
      task.totalDuration = (task.totalDuration || 0) + Number(manualDuration);
    }
    task.status = 'WORKING';
    task.completedAt = undefined;

    return {};
  } else if (newStatus === 'COMPLETED') {
    // 1. Calculate time spent on this completing task
    const elapsed = task.startedAt
      ? Math.max(1, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000))
      : (manualDuration ? Number(manualDuration) : 0);

    task.totalDuration = (task.totalDuration || 0) + elapsed;
    task.status = 'COMPLETED';
    task.progress = 100;
    task.completedAt = new Date();
    task.startedAt = undefined;

    // 2. Auto-resume the most recently updated 'PENDING' task for this employee.
    //    We do NOT emit the socket event here — the caller must emit AFTER saving
    //    the completing task so the frontend never sees it in an intermediate state.
    const nextPendingTask = await Task.findOne({
      assignedTo: empId,
      status: 'PENDING',
      _id: { $ne: task._id },
    }).sort({ updatedAt: -1 });

    if (nextPendingTask) {
      nextPendingTask.status = 'WORKING';
      nextPendingTask.startedAt = new Date();
      await nextPendingTask.save();

      await WorkLog.create({
        employeeId: empId,
        projectId: nextPendingTask.projectId,
        taskId: nextPendingTask._id,
        customTaskTitle: nextPendingTask.title,
        status: 'WORKING',
        progress: nextPendingTask.progress || 50,
        description: 'Auto-resumed timer after previous task completed',
        startTime: new Date(),
      });

      // Return the ID so the caller emits AFTER task.save()
      return { autoResumedTaskId: nextPendingTask._id.toString() };
    }

    return {};
  } else {
    // Status changed to PENDING, ON_HOLD, IN_REVIEW, NOT_STARTED, etc.
    if (task.status === 'WORKING' && task.startedAt) {
      const elapsed = Math.max(1, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000));
      task.totalDuration = (task.totalDuration || 0) + elapsed;
    } else if (manualDuration && Number(manualDuration) > 0) {
      task.totalDuration = (task.totalDuration || 0) + Number(manualDuration);
    }
    task.status = newStatus;
    task.startedAt = undefined;
    task.completedAt = undefined;

    return {};
  }
};

// @desc    Create new work log (Permanent history)
// @route   POST /api/work-logs
// @access  Private
export const createWorkLog = async (req: Request, res: Response) => {
  try {
    const { projectId, taskId, customTaskTitle, status, progress, description, restartReason, startTime, endTime, duration } = req.body;
    const employeeId = (req as any).user._id;

    let finalTaskId = taskId;
    let task = null;

    // Priority: if taskId is provided (editing existing task), use exact DB lookup.
    // This prevents a duplicate task from being created due to title mismatch.
    if (taskId) {
      task = await Task.findById(taskId);
      // If title changed, update it
      if (task && customTaskTitle && task.title !== customTaskTitle.trim()) {
        task.title = customTaskTitle.trim();
      }
    } else if (customTaskTitle) {
      // New task log: find by title or create fresh
      task = await Task.findOne({ title: customTaskTitle.trim(), assignedTo: employeeId });
      if (!task) {
        task = new Task({
          title: customTaskTitle.trim(),
          assignedTo: employeeId,
          projectId,
          progress: progress !== undefined ? Number(progress) : 0,
          description,
          restartReason: restartReason || undefined,
        });
      }
    }

    if (task) {
      if (progress !== undefined) task.progress = Number(progress);
      if (description !== undefined) task.description = description;
      if (restartReason) task.restartReason = restartReason;

      const { autoResumedTaskId } = await syncTaskTimingOnStatusChange(task, status, employeeId, duration);
      await task.save();
      finalTaskId = task._id;

      // Emit for auto-resumed task AFTER the completing task is saved as COMPLETED in DB.
      // This prevents the frontend from seeing the completing task in an intermediate PENDING state.
      if (autoResumedTaskId) {
        io.emit('worklog_updated', { _id: null, updatedTaskId: autoResumedTaskId });
      }
    }

    const calculatedDuration = duration ? Number(duration) : (task?.totalDuration || 0);

    const workLog = await WorkLog.create({
      employeeId,
      projectId: projectId || task?.projectId,
      taskId: finalTaskId,
      customTaskTitle: task?.title || customTaskTitle,
      status,
      progress: progress !== undefined ? Number(progress) : (task?.progress || 0),
      description,
      restartReason: restartReason || undefined,
      startTime: startTime || new Date(),
      endTime,
      duration: calculatedDuration,
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

    const { getWorkLogScopeFilter } = require('../utils/scopeHelper');
    const scopeFilter = await getWorkLogScopeFilter((req as any).user);
    Object.assign(query, scopeFilter);

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

// @desc    Update a work log & sync with Task (edit history & restart work)
// @route   PUT /api/work-logs/:id
// @access  Private
export const updateWorkLog = async (req: Request, res: Response) => {
  try {
    const { customTaskTitle, status, description, progress, restartReason } = req.body;
    const workLog = await WorkLog.findById(req.params.id);
    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }

    const user = (req as any).user;
    const isOwner = workLog.employeeId && workLog.employeeId.toString() === user._id.toString();
    const isAdmin = user.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to edit this work log' });
    }

    const previousTitle = workLog.customTaskTitle;

    // Update work log fields
    if (customTaskTitle !== undefined) workLog.customTaskTitle = customTaskTitle.trim();
    if (status !== undefined) workLog.status = status;
    if (description !== undefined) workLog.description = description;
    if (restartReason !== undefined) workLog.restartReason = restartReason;
    if (progress !== undefined) workLog.progress = Number(progress);

    await workLog.save();

    // Sync with corresponding Task so it reflects on Dashboard & Admin status
    let task = null;
    if (workLog.taskId) {
      task = await Task.findById(workLog.taskId);
    }
    if (!task && (customTaskTitle || previousTitle)) {
      task = await Task.findOne({
        title: (customTaskTitle || previousTitle).trim(),
        assignedTo: workLog.employeeId,
      });
    }

    if (task) {
      if (customTaskTitle) task.title = customTaskTitle.trim();
      if (restartReason !== undefined) task.restartReason = restartReason;
      if (description !== undefined) task.description = description;
      if (progress !== undefined) {
        task.progress = Number(progress);
      }
      let autoResumedTaskId: string | undefined;
      if (status !== undefined) {
        const result = await syncTaskTimingOnStatusChange(task, status, workLog.employeeId);
        autoResumedTaskId = result.autoResumedTaskId;
      }
      await task.save();

      // Emit for auto-resumed task AFTER completing task is persisted
      if (autoResumedTaskId) {
        io.emit('worklog_updated', { _id: null, updatedTaskId: autoResumedTaskId });
      }

      if (!workLog.taskId) {
        workLog.taskId = task._id;
        await workLog.save();
      }
    } else if (customTaskTitle || workLog.customTaskTitle) {
      // If task didn't exist in Task collection, create it so it shows on Dashboard
      task = new Task({
        title: (customTaskTitle || workLog.customTaskTitle).trim(),
        assignedTo: workLog.employeeId,
        progress: progress !== undefined ? Number(progress) : ((status || workLog.status) === 'COMPLETED' ? 100 : 50),
        description: description !== undefined ? description : workLog.description,
        restartReason: restartReason || undefined,
      });
      const result = await syncTaskTimingOnStatusChange(task, status || workLog.status, workLog.employeeId);
      await task.save();
      if (result.autoResumedTaskId) {
        io.emit('worklog_updated', { _id: null, updatedTaskId: result.autoResumedTaskId });
      }
      workLog.taskId = task._id;
      await workLog.save();
    }

    const populatedLog = await WorkLog.findById(workLog._id)
      .populate('employeeId', 'name email department designation role profileImage')
      .populate('projectId', 'name')
      .populate('taskId', 'title description status progress');

    // Emit socket event for real-time dashboard update (Admin + Employee)
    io.emit('worklog_updated', populatedLog);

    res.json(populatedLog);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
