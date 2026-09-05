import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';
import WorkLog from '../models/WorkLog';
import connectDB from '../config/db';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany();
    await Project.deleteMany();
    await Task.deleteMany();
    await WorkLog.deleteMany();

    // Create Admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'fast@gmail.com',
      password: 'password123',
      role: 'ADMIN',
      department: 'Management',
    });

    // Create Employees
    const employeesData = [
      { name: 'Rahul Sharma', email: 'rahul@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'Engineering' },
      { name: 'Priya Patel', email: 'priya@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'Design' },
      { name: 'Amit Verma', email: 'amit@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'QA' },
      { name: 'Neha Singh', email: 'neha@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'Engineering' },
      { name: 'Ankit Jain', email: 'ankit@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'Marketing' },
      { name: 'Sneha Gupta', email: 'sneha@workpulse.com', password: 'password123', role: 'EMPLOYEE', department: 'HR' },
    ];

    const employees = await User.insertMany(employeesData);

    // Create Projects
    const projectsData = [
      {
        name: 'CRM System',
        description: 'New CRM development',
        projectManager: admin._id,
        members: [employees[0]._id, employees[1]._id, employees[2]._id],
        status: 'ACTIVE',
        priority: 'HIGH',
      },
      {
        name: 'E-Commerce Platform',
        description: 'E-commerce platform migration',
        projectManager: admin._id,
        members: [employees[3]._id, employees[4]._id],
        status: 'ACTIVE',
        priority: 'URGENT',
      },
      {
        name: 'Xero Integration',
        description: 'Accounting system sync',
        projectManager: admin._id,
        members: [employees[0]._id],
        status: 'ACTIVE',
        priority: 'MEDIUM',
      },
      {
        name: 'Admin Portal',
        description: 'Internal admin dashboard',
        projectManager: admin._id,
        members: [employees[1]._id, employees[5]._id],
        status: 'ACTIVE',
        priority: 'LOW',
      }
    ];

    const projects = await Project.insertMany(projectsData);

    // Create Tasks
    const tasksData = [
      {
        title: 'Login UI',
        description: 'Create login interface for CRM',
        projectId: projects[0]._id,
        assignedTo: employees[1]._id, // Priya (Design)
        priority: 'HIGH',
        status: 'COMPLETED',
        progress: 100,
      },
      {
        title: 'API Integration',
        description: 'Integrate CRM auth APIs',
        projectId: projects[0]._id,
        assignedTo: employees[0]._id, // Rahul (Engineering)
        priority: 'URGENT',
        status: 'WORKING',
        progress: 50,
      },
      {
        title: 'Cart Component',
        description: 'Build shopping cart',
        projectId: projects[1]._id,
        assignedTo: employees[3]._id, // Neha (Engineering)
        priority: 'HIGH',
        status: 'WORKING',
        progress: 75,
      }
    ];

    const tasks = await Task.insertMany(tasksData);

    // Create WorkLogs (History for Rahul)
    const today = new Date();
    
    await WorkLog.insertMany([
      {
        employeeId: employees[0]._id, // Rahul
        projectId: projects[0]._id, // CRM
        taskId: tasks[1]._id, // API Integration
        status: 'WORKING',
        progress: 10,
        description: 'Started API Integration',
        startTime: new Date(today.setHours(10, 0, 0, 0)),
        duration: 120, // 2 hours
      },
      {
        employeeId: employees[0]._id,
        projectId: projects[0]._id,
        taskId: tasks[1]._id,
        status: 'IN_REVIEW',
        progress: 50,
        description: 'Sent for review',
        startTime: new Date(today.setHours(14, 0, 0, 0)),
        duration: 120,
      }
    ]);

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
};

seedData();
