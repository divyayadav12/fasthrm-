import { Request, Response } from 'express';
import Project from '../models/Project';
import { getProjectScopeFilter } from '../utils/scopeHelper';

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req: Request, res: Response) => {
  try {
    const scopeFilter = await getProjectScopeFilter((req as any).user);
    
    const projects = await Project.find(scopeFilter)
      .populate('projectManager', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectManager', 'name email')
      .populate('members', 'name email');
      
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create project
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description, projectManager, members, startDate, deadline, priority } = req.body;
    
    const project = await Project.create({
      name,
      description,
      projectManager,
      members,
      startDate,
      deadline,
      priority,
    });
    
    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private/Admin
export const updateProject = async (req: Request, res: Response) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
