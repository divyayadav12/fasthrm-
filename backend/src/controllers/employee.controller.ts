import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private/Admin
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const { search, department, role, page = '1', limit = '10' } = req.query;
    const query: any = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (department) query.department = department;
    if (role) query.role = role;

    const { getUserScopeFilter } = require('../utils/scopeHelper');
    const scopeFilter = await getUserScopeFilter((req as any).user);
    Object.assign(query, scopeFilter);

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const startIndex = (pageNumber - 1) * limitNumber;

    const total = await User.countDocuments(query);
    const employees = await User.find(query)
      .select('-password')
      .skip(startIndex)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    res.json({
      employees,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      total,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const employee = await User.findById(req.params.id).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private/Admin
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, department, designation } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department,
      designation,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private/Admin
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.role = req.body.role || user.role;
      user.department = req.body.department || user.department;
      user.designation = req.body.designation || user.designation;
      if (req.body.isActive !== undefined) user.isActive = req.body.isActive;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        isActive: updatedUser.isActive,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete employee (soft delete or hard delete)
// @route   DELETE /api/employees/:id
// @access  Private/Admin
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
