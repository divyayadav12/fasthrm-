import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';
import Project from '../models/Project';
import Task from '../models/Task';
import { getProjectScopeFilter, getTaskScopeFilter } from '../utils/scopeHelper';

// @desc    Get employee productivity report
// @route   GET /api/reports/employee
// @access  Private/Admin
export const getEmployeeReport = async (req: Request, res: Response) => {
  try {
    const { employeeId, dateFrom, dateTo } = req.query;
    const match: any = {};
    
    if (employeeId) match.employeeId = employeeId;
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) match.createdAt.$lte = new Date(dateTo as string);
    }

    const taskScopeFilter = await getTaskScopeFilter((req as any).user);
    if (taskScopeFilter.projectId) {
      match.projectId = taskScopeFilter.projectId;
    }

    const productivity = await WorkLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employeeId',
          totalDuration: { $sum: '$duration' },
          tasksWorkedOn: { $addToSet: '$taskId' },
          completedLogs: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $project: {
          employeeName: '$employee.name',
          totalDuration: 1,
          tasksWorkedOnCount: { $size: '$tasksWorkedOn' },
          completedLogs: 1
        }
      }
    ]);

    res.json(productivity);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get project progress report
// @route   GET /api/reports/project
// @access  Private/Admin
export const getProjectReport = async (req: Request, res: Response) => {
  try {
    const projectScope = await getProjectScopeFilter((req as any).user);
    const projects = await Project.find(projectScope).select('name status');
    
    const projectStats = await Promise.all(projects.map(async (project) => {
      const totalTasks = await Task.countDocuments({ projectId: project._id });
      const completedTasks = await Task.countDocuments({ projectId: project._id, status: 'COMPLETED' });
      
      return {
        _id: project._id,
        name: project.name,
        status: project.status,
        totalTasks,
        completedTasks,
        completionPercentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
      };
    }));

    res.json(projectStats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get overall productivity/dashboard stats
// @route   GET /api/reports/productivity
// @access  Private/Admin
export const getProductivityStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const projectScope = await getProjectScopeFilter((req as any).user);
    const activeProjects = await Project.countDocuments({ ...projectScope, status: 'ACTIVE' });
    
    const taskScope = await getTaskScopeFilter((req as any).user);

    // Check completed tasks today from both WorkLog and Task collections
    const completedWorkLogsToday = await WorkLog.find({
      ...taskScope,
      status: 'COMPLETED',
      createdAt: { $gte: today }
    });

    const uniqueCompletedFromLogs = new Set(
      completedWorkLogsToday.map(log => log.taskId?.toString() || log.customTaskTitle || log._id.toString())
    ).size;

    const completedFromTasks = await Task.countDocuments({
      ...taskScope,
      status: 'COMPLETED',
      $or: [
        { completedAt: { $gte: today } },
        { updatedAt: { $gte: today } }
      ]
    });

    const completedTasksToday = Math.max(uniqueCompletedFromLogs, completedFromTasks);

    const currentlyWorking = await WorkLog.aggregate([
      { $match: { createdAt: { $gte: today }, ...taskScope } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$employeeId',
          latestStatus: { $first: '$status' }
        }
      },
      { $match: { latestStatus: 'WORKING' } }
    ]);

    res.json({
      activeProjects,
      completedTasksToday,
      currentlyWorking: currentlyWorking.length
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee's own task-level time breakdown report
// @route   GET /api/reports/my-tasks
// @access  Private (Employee + Admin)
export const getMyTaskReport = async (req: Request, res: Response) => {
  try {
    const employeeId = (req as any).user._id;
    const { dateFrom, dateTo } = req.query;

    // Date filter for WorkLog lookups
    const dateMatch: any = {};
    if (dateFrom || dateTo) {
      dateMatch.createdAt = {};
      if (dateFrom) dateMatch.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) dateMatch.createdAt.$lte = new Date(dateTo as string);
    }

    // Fetch all tasks belonging to this employee
    const tasks = await Task.find({ assignedTo: employeeId }).sort({ updatedAt: -1 });

    // Aggregate latest worklog date per task
    const taskIds = tasks.map((t) => t._id);
    const latestLogPerTask = await WorkLog.aggregate([
      {
        $match: {
          employeeId,
          taskId: { $in: taskIds },
          ...dateMatch,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$taskId',
          lastActivity: { $first: '$createdAt' },
          logCount: { $sum: 1 },
        },
      },
    ]);

    const logMap: Record<string, { lastActivity: Date; logCount: number }> = {};
    for (const entry of latestLogPerTask) {
      logMap[entry._id.toString()] = {
        lastActivity: entry.lastActivity,
        logCount: entry.logCount,
      };
    }

    // Build report — include live elapsed time for WORKING tasks
    const now = Date.now();
    const report = tasks.map((task) => {
      let totalMinutes = task.totalDuration || 0;
      if (task.status === 'WORKING' && task.startedAt) {
        const liveElapsed = Math.max(0, Math.round((now - new Date(task.startedAt).getTime()) / 60000));
        totalMinutes += liveElapsed;
      }
      const logInfo = logMap[task._id.toString()];
      const taskAny = task as any; // Mongoose timestamps not typed in ITask
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        progress: task.progress,
        totalMinutes,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        lastActivity: logInfo?.lastActivity || taskAny.updatedAt,
        logCount: logInfo?.logCount || 0,
        createdAt: taskAny.createdAt,
      };
    });

    const totalMinutesAll = report.reduce((sum, t) => sum + t.totalMinutes, 0);

    res.json({
      tasks: report,
      summary: {
        totalTasks: report.length,
        completedTasks: report.filter((t) => t.status === 'COMPLETED').length,
        activeTasks: report.filter((t) => t.status === 'WORKING').length,
        pendingTasks: report.filter((t) => t.status === 'PENDING').length,
        totalMinutes: totalMinutesAll,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
