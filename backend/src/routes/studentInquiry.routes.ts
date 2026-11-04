import express from 'express';
import { protect, supportOrAdminOnly, adminOnly } from '../middleware/auth.middleware';
import {
  createStudentInquiry,
  getStudentInquiries,
  lookupStudentByPhone,
  getSupportStaffList,
  getStudentInquiryById,
  updateStudentInquiry,
  deleteStudentInquiry,
  sendStudentFeedback,
  getSubjectSuggestions,
  getPurchasedStaffStats,
  appendStudentInquiryFollowUp,
} from '../controllers/studentInquiry.controller';

const router = express.Router();

// Allow all authenticated users to get support staff list
router.get('/support-staff', protect, getSupportStaffList);

// Apply protect + supportOrAdminOnly to all student inquiry CRUD routes
router.use(protect);
router.use(supportOrAdminOnly);

router.route('/')
  .get(getStudentInquiries)
  .post(createStudentInquiry);

router.get('/purchased-stats', getPurchasedStaffStats);
router.get('/lookup', lookupStudentByPhone);
router.get('/subject-suggestions', getSubjectSuggestions);

router.post('/:id/send-feedback', sendStudentFeedback);
router.post('/:id/follow-ups', appendStudentInquiryFollowUp);

router.route('/:id')
  .get(getStudentInquiryById)
  .put(updateStudentInquiry)
  .delete(adminOnly, deleteStudentInquiry);

export default router;
