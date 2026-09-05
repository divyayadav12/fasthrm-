import express from 'express';
import { getTasks, getTaskById, createTask, updateTask, deleteTask } from '../controllers/task.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = express.Router();

router.route('/')
  .get(protect, getTasks)
  .post(protect, adminOnly, createTask);

router.route('/:id')
  .get(protect, getTaskById)
  .put(protect, updateTask)
  .delete(protect, adminOnly, deleteTask);

export default router;
