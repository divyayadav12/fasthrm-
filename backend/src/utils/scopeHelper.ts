import User from '../models/User';

const getCareerUserIds = async () => {
  // Find all users whose department matches 'career' or 'careear' (case-insensitive)
  const careerUsers = await User.find({
    department: { $regex: /career|careear/i }
  }).select('_id');
  return careerUsers.map(u => u._id);
};

export const getProjectScopeFilter = async (user: any) => {
  // We no longer filter Projects based on department directly,
  // but if needed we could return something. For now, return empty.
  return {};
};

export const getTaskScopeFilter = async (user: any) => {
  if (!user || user.role !== 'ADMIN' || !user.adminScope || user.adminScope === 'ALL') {
    return {};
  }

  const careerUserIds = await getCareerUserIds();

  if (user.adminScope === 'ONLY_FAST_CAREERS') {
    return { assignedTo: { $in: careerUserIds } };
  }

  if (user.adminScope === 'EXCLUDE_FAST_CAREERS') {
    return { assignedTo: { $nin: careerUserIds } };
  }

  return {};
};

export const getWorkLogScopeFilter = async (user: any) => {
  if (!user || user.role !== 'ADMIN' || !user.adminScope || user.adminScope === 'ALL') {
    return {};
  }

  const careerUserIds = await getCareerUserIds();

  if (user.adminScope === 'ONLY_FAST_CAREERS') {
    return { employeeId: { $in: careerUserIds } };
  }

  if (user.adminScope === 'EXCLUDE_FAST_CAREERS') {
    return { employeeId: { $nin: careerUserIds } };
  }

  return {};
};

export const getUserScopeFilter = async (user: any) => {
  if (!user || user.role !== 'ADMIN' || !user.adminScope || user.adminScope === 'ALL') {
    return {};
  }

  const careerUserIds = await getCareerUserIds();

  if (user.adminScope === 'ONLY_FAST_CAREERS') {
    return { _id: { $in: careerUserIds } };
  }

  if (user.adminScope === 'EXCLUDE_FAST_CAREERS') {
    return { _id: { $nin: careerUserIds } };
  }

  return {};
};

