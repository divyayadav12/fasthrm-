import { Request, Response } from 'express';
import Leave from '../models/Leave';
import Notification from '../models/Notification';
import User from '../models/User';
import { getUserScopeFilter } from '../utils/scopeHelper';

export const applyLeave = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reason } = req.body;
    const employeeId = (req as any).user._id;

    const leave = await Leave.create({
      employeeId,
      startDate,
      endDate,
      reason,
    });

    const user = await User.findById(employeeId);

    // Notify all admins (with scope matching)
    // Sarthak sees all, Ritesh sees Career, Pravin sees non-Career
    const admins = await User.find({ role: 'ADMIN' });
    const isCareer = user?.department?.toLowerCase().includes('career') || user?.department?.toLowerCase().includes('careear');
    
    for (const admin of admins) {
      let shouldNotify = false;
      if (admin.adminScope === 'ALL') {
        shouldNotify = true;
      } else if (admin.adminScope === 'ONLY_FAST_CAREERS' && isCareer) {
        shouldNotify = true;
      } else if (admin.adminScope === 'EXCLUDE_FAST_CAREERS' && !isCareer) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        await Notification.create({
          userId: admin._id,
          title: 'New Leave Request',
          message: `${user?.name || 'An employee'} has requested leave from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
          type: 'INFO'
        });
      }
    }

    res.status(201).json(leave);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyLeaves = async (req: Request, res: Response) => {
  try {
    const leaves = await Leave.find({ employeeId: (req as any).user._id }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllLeaves = async (req: Request, res: Response) => {
  try {
    const scopeFilter = await getUserScopeFilter((req as any).user);
    
    // We need to fetch all leaves where the employee matches the scope filter
    // 1. Get user IDs that match the scope
    const usersInScope = await User.find(scopeFilter).select('_id');
    const userIds = usersInScope.map(u => u._id);

    const leaves = await Leave.find({ employeeId: { $in: userIds } })
      .populate('employeeId', 'name email department')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  try {
    const { status, adminComment } = req.body;
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    leave.status = status;
    if (adminComment !== undefined) {
      leave.adminComment = adminComment;
    }

    await leave.save();

    // Notify employee
    await Notification.create({
      userId: leave.employeeId,
      title: 'Leave Status Updated',
      message: `Your leave request has been ${status}.`,
      type: status === 'Approved' ? 'SUCCESS' : 'WARNING'
    });

    res.json(leave);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
