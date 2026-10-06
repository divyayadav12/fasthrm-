import { Response } from 'express';
import https from 'https';
import { AuthRequest } from '../middleware/auth.middleware';
import StudentInquiry from '../models/StudentInquiry';

/**
 * Generate sequential human-readable inquiry ID (e.g. INQ-1001, INQ-1002)
 */
export const generateNextInquiryId = async (): Promise<string> => {
  const latest = await StudentInquiry.findOne({}, { inquiryId: 1 })
    .sort({ createdAt: -1 })
    .lean();

  if (!latest || !latest.inquiryId) {
    return 'INQ-1001';
  }

  const match = latest.inquiryId.match(/INQ-(\d+)/i);
  if (match && match[1]) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `INQ-${nextNum}`;
  }

  const count = await StudentInquiry.countDocuments();
  return `INQ-${1001 + count}`;
};

/**
 * @desc    Lookup student call history by phone number
 * @route   GET /api/student-inquiries/lookup?phone=9876543210
 * @access  Private (Support & Admin)
 */
export const lookupStudentByPhone = async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string' || phone.trim().length < 4) {
      return res.json({ found: false, count: 0, inquiries: [] });
    }

    const cleanPhone = phone.trim().replace(/\D/g, ''); // Extract numeric
    const searchRegex = new RegExp(cleanPhone.length >= 6 ? cleanPhone.slice(-10) : cleanPhone, 'i');

    const pastInquiries = await StudentInquiry.find({
      $or: [
        { mobileNumber: { $regex: searchRegex } },
        { alternateNumber: { $regex: searchRegex } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (pastInquiries.length === 0) {
      return res.json({
        found: false,
        count: 0,
        studentName: '',
        latestInquiry: null,
        inquiries: [],
      });
    }

    const latest = pastInquiries[0];
    res.json({
      found: true,
      count: pastInquiries.length,
      studentName: latest.studentName,
      latestInquiry: latest,
      inquiries: pastInquiries,
    });
  } catch (error: any) {
    console.error('Error looking up student phone:', error);
    res.status(500).json({ message: error.message || 'Error looking up phone number' });
  }
};

/**
 * @desc    Create a new student inquiry
 * @route   POST /api/student-inquiries
 * @access  Private (Support & Admin)
 */
export const createStudentInquiry = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const {
      studentName,
      mobileNumber,
      alternateNumber,
      email,
      callType,
      subject,
      details,
      remark,
      status,
      forwardedBy,
      forwardedTo,
      previousInquiryId,
      followUpDate,
    } = req.body;

    if (!studentName || !mobileNumber) {
      return res.status(400).json({
        message: 'Student name and mobile number are required.',
      });
    }

    const inquiryId = await generateNextInquiryId();

    let previousInquiryRef: any = undefined;
    if (previousInquiryId && previousInquiryId.trim()) {
      const prevDoc = await StudentInquiry.findOne({
        inquiryId: previousInquiryId.trim().toUpperCase(),
      });
      if (prevDoc) {
        previousInquiryRef = prevDoc._id;
      }
    }

    const newInquiry = await StudentInquiry.create({
      inquiryId,
      studentName: studentName.trim(),
      mobileNumber: mobileNumber.trim(),
      alternateNumber: alternateNumber ? alternateNumber.trim() : '',
      email: email ? email.trim() : '',
      callType: callType || 'Enquiry',
      subject: subject ? subject.trim() : '',
      details: details ? details.trim() : '',
      remark: remark ? remark.trim() : '',
      status: status || 'Follow Up',
      forwardedBy: forwardedBy ? forwardedBy.trim() : (user.name || ''),
      forwardedTo: forwardedTo ? forwardedTo.trim() : '',
      addedBy: user._id,
      addedByName: user.name,
      addedByEmail: user.email,
      addedByDepartment: user.department || user.designation || 'Staff',
      previousInquiryId: previousInquiryId ? previousInquiryId.trim().toUpperCase() : '',
      previousInquiryRef,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      resolvedAt: status === 'Solved' ? new Date() : undefined,
    });

    res.status(201).json({
      success: true,
      message: `Inquiry ${inquiryId} created successfully!`,
      inquiry: newInquiry,
    });
  } catch (error: any) {
    console.error('Error creating student inquiry:', error);
    res.status(500).json({ message: error.message || 'Failed to create student inquiry' });
  }
};

/**
 * @desc    Get all student inquiries with filters, search, and pagination
 * @route   GET /api/student-inquiries
 * @access  Private (Support & Admin)
 */
export const getStudentInquiries = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      callType,
      addedBy,
      dateFrom,
      dateTo,
      followUpDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query: any = {};

    // Search text filter
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      query.$or = [
        { inquiryId: { $regex: s, $options: 'i' } },
        { studentName: { $regex: s, $options: 'i' } },
        { mobileNumber: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } },
        { details: { $regex: s, $options: 'i' } },
        { addedByName: { $regex: s, $options: 'i' } },
        { previousInquiryId: { $regex: s, $options: 'i' } },
      ];
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (callType && callType !== 'ALL') {
      query.callType = callType;
    }

    if (addedBy && addedBy !== 'ALL') {
      query.addedBy = addedBy;
    }

    if (followUpDate && typeof followUpDate === 'string' && followUpDate.trim()) {
      const fDate = new Date(followUpDate.trim());
      const startOfDay = new Date(fDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(fDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.followUpDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom as string);
        d.setHours(0, 0, 0, 0);
        query.createdAt.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo as string);
        d.setHours(23, 59, 59, 999);
        query.createdAt.$lte = d;
      }
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const [inquiries, totalCount] = await Promise.all([
      StudentInquiry.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('addedBy', 'name email department designation')
        .lean(),
      StudentInquiry.countDocuments(query),
    ]);

    // Aggregate overall KPI stats
    const statsPipeline: any = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const [statusStats, callTypeStats] = await Promise.all([
      StudentInquiry.aggregate(statsPipeline),
      StudentInquiry.aggregate([
        {
          $group: {
            _id: '$callType',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statsMap: Record<string, number> = {
      total: totalCount,
      solved: 0,
      followUp: 0,
      purchases: 0,
      pending: 0,
      others: 0,
    };

    statusStats.forEach((st) => {
      const key = st._id ? st._id.toString().toLowerCase() : 'others';
      if (key === 'solved') statsMap.solved = st.count;
      else if (key === 'follow up' || key === 'followup') statsMap.followUp = st.count;
      else if (key === 'purchases' || key === 'purchase') statsMap.purchases = st.count;
      else if (key === 'pending') statsMap.pending = st.count;
      else statsMap.others += st.count;
    });

    const callTypeMap: Record<string, number> = {};
    callTypeStats.forEach((ct) => {
      if (ct._id) callTypeMap[ct._id] = ct.count;
    });

    res.json({
      success: true,
      inquiries,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      stats: {
        ...statsMap,
        byCallType: callTypeMap,
      },
    });
  } catch (error: any) {
    console.error('Error fetching student inquiries:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch inquiries' });
  }
};

/**
 * @desc    Get inquiry details + full history timeline for that student/phone
 * @route   GET /api/student-inquiries/:id
 * @access  Private (Support & Admin)
 */
export const getStudentInquiryById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inquiry = await StudentInquiry.findById(id)
      .populate('addedBy', 'name email department designation')
      .lean();

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    // Fetch related inquiries for this same student/mobile number
    const cleanPhone = inquiry.mobileNumber.replace(/\D/g, '');
    const relatedInquiries = await StudentInquiry.find({
      _id: { $ne: inquiry._id },
      $or: [
        { mobileNumber: { $regex: cleanPhone.slice(-10) } },
        { previousInquiryId: inquiry.inquiryId },
        { inquiryId: inquiry.previousInquiryId },
      ],
    })
      .sort({ createdAt: -1 })
      .populate('addedBy', 'name email department designation')
      .lean();

    res.json({
      success: true,
      inquiry,
      relatedInquiries,
    });
  } catch (error: any) {
    console.error('Error fetching inquiry details:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch inquiry details' });
  }
};

/**
 * @desc    Update inquiry status, remark, or details
 * @route   PUT /api/student-inquiries/:id
 * @access  Private (Support & Admin)
 */
export const updateStudentInquiry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      studentName,
      mobileNumber,
      alternateNumber,
      email,
      callType,
      subject,
      details,
      remark,
      status,
      forwardedBy,
      forwardedTo,
      previousInquiryId,
      followUpDate,
    } = req.body;

    const inquiry = await StudentInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    if (studentName !== undefined && studentName.trim()) {
      const newName = studentName.trim();
      inquiry.studentName = newName;
      const cleanPhone = (inquiry.mobileNumber || '').replace(/\D/g, '');
      if (cleanPhone.length >= 6) {
        await StudentInquiry.updateMany(
          { mobileNumber: { $regex: cleanPhone.slice(-10) } },
          { studentName: newName }
        );
      }
    }
    if (mobileNumber !== undefined) inquiry.mobileNumber = mobileNumber.trim();
    if (alternateNumber !== undefined) inquiry.alternateNumber = alternateNumber.trim();
    if (email !== undefined) inquiry.email = email.trim();
    if (callType !== undefined) inquiry.callType = callType;
    if (subject !== undefined) inquiry.subject = subject.trim();
    if (details !== undefined) inquiry.details = details.trim();
    if (remark !== undefined) inquiry.remark = remark.trim();
    if (forwardedBy !== undefined) inquiry.forwardedBy = forwardedBy.trim();
    if (forwardedTo !== undefined) inquiry.forwardedTo = forwardedTo.trim();
    if (previousInquiryId !== undefined) inquiry.previousInquiryId = previousInquiryId.trim().toUpperCase();
    if (followUpDate !== undefined) inquiry.followUpDate = followUpDate ? new Date(followUpDate) : undefined;

    if (status !== undefined) {
      inquiry.status = status;
      if (status === 'Solved' && !inquiry.resolvedAt) {
        inquiry.resolvedAt = new Date();
      }
    }

    await inquiry.save();

    res.json({
      success: true,
      message: 'Inquiry updated successfully',
      inquiry,
    });
  } catch (error: any) {
    console.error('Error updating student inquiry:', error);
    res.status(500).json({ message: error.message || 'Failed to update inquiry' });
  }
};

/**
 * @desc    Delete inquiry
 * @route   DELETE /api/student-inquiries/:id
 * @access  Private (Admin Only)
 */
export const deleteStudentInquiry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inquiry = await StudentInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    await StudentInquiry.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Inquiry ${inquiry.inquiryId} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting student inquiry:', error);
    res.status(500).json({ message: error.message || 'Failed to delete inquiry' });
  }
};

/**
 * @desc    Get all IT & Support staff for forwarding inquiries
 * @route   GET /api/student-inquiries/support-staff
 * @access  Private (Support & Admin)
 */
export const getSupportStaffList = async (req: AuthRequest, res: Response) => {
  try {
    const User = (await import('../models/User')).default;
    const staff = await User.find({
      name: { $nin: [/^unknown$/i, '', null] },
    })
      .select('_id name email department designation role')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, staff });
  } catch (error: any) {
    console.error('Error fetching support staff list:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch staff list' });
  }
};

/**
 * @desc    Send WhatsApp Feedback Message via Teleobi Webhook
 * @route   POST /api/student-inquiries/:id/send-feedback
 * @access  Private (Support & Admin)
 */
export const sendStudentFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const inquiry = await StudentInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    if (inquiry.feedbackSent) {
      return res.status(400).json({ message: 'Feedback has already been sent for this student.' });
    }

    const rawPhone = (inquiry.mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (!rawPhone || rawPhone.length !== 10) {
      return res.status(400).json({ message: 'Valid 10-digit mobile number is required.' });
    }

    const formattedPhone = `91${rawPhone}`;
    const webhookUrl = 'https://dash.teleobi.com/webhook/whatsapp-workflow/61602.183817.415500.1785233215';

    // Call Teleobi Webhook using Node fetch
    try {
      const payloadData = JSON.stringify({
        phoneNumber: formattedPhone,
        studentName: inquiry.studentName || '',
        name: inquiry.studentName || '',
        inquiryId: inquiry.inquiryId || '',
        subject: inquiry.subject || '',
        details: inquiry.details || '',
      });

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: payloadData,
      });

      const responseText = await response.text();
      console.log('Teleobi webhook response:', response.status, responseText);
      
      let isSuccess = response.ok;
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          if (json.status === 0 || json.sent === false) {
            isSuccess = false;
          }
        } catch (e) {}
      }

      if (!isSuccess) {
        throw new Error(`Teleobi webhook failed: ${responseText}`);
      }
    } catch (webhookErr: any) {
      console.error('Teleobi Webhook error:', webhookErr?.message || webhookErr);
      return res.status(500).json({ message: webhookErr?.message || 'Failed to trigger Teleobi webhook' });
    }

    inquiry.feedbackSent = true;
    inquiry.feedbackSentAt = new Date();
    await inquiry.save();

    res.json({
      success: true,
      message: 'Feedback message sent successfully!',
      inquiry,
    });
  } catch (error: any) {
    console.error('Error sending feedback message:', error);
    res.status(500).json({ message: error.message || 'Failed to send feedback message' });
  }
};
