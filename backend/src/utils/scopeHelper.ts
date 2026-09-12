import Project from '../models/Project';

export const getProjectScopeFilter = async (user: any) => {
  if (!user || user.role !== 'ADMIN' || !user.adminScope || user.adminScope === 'ALL') {
    return {};
  }

  const fastCareersProject = await Project.findOne({ name: { $regex: /^fast careers$/i } });

  if (user.adminScope === 'ONLY_FAST_CAREERS') {
    if (!fastCareersProject) {
      return { _id: null };
    }
    return { _id: fastCareersProject._id };
  }

  if (user.adminScope === 'EXCLUDE_FAST_CAREERS') {
    if (!fastCareersProject) {
      return {};
    }
    return { _id: { $ne: fastCareersProject._id } };
  }

  return {};
};

export const getTaskScopeFilter = async (user: any) => {
  if (!user || user.role !== 'ADMIN' || !user.adminScope || user.adminScope === 'ALL') {
    return {};
  }

  const fastCareersProject = await Project.findOne({ name: { $regex: /^fast careers$/i } });

  if (user.adminScope === 'ONLY_FAST_CAREERS') {
    if (!fastCareersProject) return { projectId: null };
    return { projectId: fastCareersProject._id };
  }

  if (user.adminScope === 'EXCLUDE_FAST_CAREERS') {
    if (!fastCareersProject) return {};
    return { projectId: { $ne: fastCareersProject._id } };
  }

  return {};
};
