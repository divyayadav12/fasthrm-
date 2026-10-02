import express from 'express';
import { protect, supportOrAdminOnly, adminOnly } from '../middleware/auth.middleware';
import {
  createStudentInquiry,
  getStudentInquiries,
  lookupStudentByPhone,
  getStudentInquiryById,
  updateStudentInquiry,
  deleteStudentInquiry,
} from '../controllers/studentInquiry.controller';

const router = express.Router();

// Apply protect + supportOrAdminOnly to all routes
router.use(protect);
router.use(supportOrAdminOnly);

router.route('/')
  .get(getStudentInquiries)
  .post(createStudentInquiry);

router.get('/lookup', lookupStudentByPhone);

router.route('/:id')
  .get(getStudentInquiryById)
  .put(updateStudentInquiry)
  .delete(adminOnly, deleteStudentInquiry);

export default router;
