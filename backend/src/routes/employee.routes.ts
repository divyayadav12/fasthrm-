import express from 'express';
import { getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from '../controllers/employee.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.route('/')
  .get(protect, adminOnly, getEmployees)
  .post(protect, adminOnly, createEmployee);

router.route('/:id')
  .get(protect, getEmployeeById)
  .put(protect, adminOnly, updateEmployee)
  .delete(protect, adminOnly, deleteEmployee);

export default router;
