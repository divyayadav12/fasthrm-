import { Request, Response } from 'express';
import WorkLog from '../models/WorkLog';
import Project from '../models/Project';
import Task from '../models/Task';

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
    const projects = await Project.find().select('name status');
    
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

    const activeProjects = await Project.countDocuments({ status: 'ACTIVE' });
    
    // Check completed tasks today from both WorkLog and Task collections
    const completedWorkLogsToday = await WorkLog.find({
      status: 'COMPLETED',
      createdAt: { $gte: today }
    });

    const uniqueCompletedFromLogs = new Set(
      completedWorkLogsToday.map(log => log.taskId?.toString() || log.customTaskTitle || log._id.toString())
    ).size;

    const completedFromTasks = await Task.countDocuments({
      status: 'COMPLETED',
      $or: [
        { completedAt: { $gte: today } },
        { updatedAt: { $gte: today } }
      ]
    });

    const completedTasksToday = Math.max(uniqueCompletedFromLogs, completedFromTasks);

    // Currently working employees can be determined by socket or by checking latest worklog per employee
    // For simplicity, we can fetch from worklogs where status is 'WORKING' and date is today
    const currentlyWorking = await WorkLog.aggregate([
      { $match: { createdAt: { $gte: today } } },
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
