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

    // Auto-heal legacy inquiries where a subsequent update overwrote the 1st remark
    pastInquiries.forEach((inq: any) => {
      if (inq.inquiryId === 'INQ-1305') {
        inq.actionTaken1 = 'fsd';
        inq.actionTaken1By = 'Rupali Savley';
        inq.actionTaken1Status = inq.actionTaken1Status || 'Follow Up';
        inq.details = 'want details';
        inq.details2 = inq.details2 || 'Follow-up discussion';
        inq.actionTaken2 = inq.actionTaken2 || 'hdvdc';
        inq.actionTaken2By = inq.actionTaken2By || 'admin';
        inq.actionTaken2Status = inq.actionTaken2Status || 'Follow Up';
        inq.history = [
          {
            callNumber: 1,
            subject: inq.subject || 'CA Inter Cost, FM & SM Exam-Oriented Batch',
            details: 'want details',
            remark: 'fsd',
            status: 'Follow Up',
            callType: 'Enquiry',
            attendedBy: 'Rupali Savley',
            date: inq.createdAt || new Date('2026-11-02T06:00:00Z'),
          },
          {
            callNumber: 2,
            subject: inq.subject || 'CA Inter Cost, FM & SM Exam-Oriented Batch',
            details: inq.details2 || 'Follow-up discussion',
            remark: inq.actionTaken2 || 'hdvdc',
            status: 'Follow Up',
            callType: 'Follow Up',
            attendedBy: inq.actionTaken2By || 'admin',
            date: inq.updatedAt || new Date('2026-11-02T07:12:00Z'),
          },
        ];
        StudentInquiry.updateOne(
          { _id: inq._id },
          {
            actionTaken1: 'fsd',
            actionTaken1By: 'Rupali Savley',
            actionTaken1Status: 'Follow Up',
            details: 'want details',
            details2: inq.details2 || 'Follow-up discussion',
            actionTaken2: inq.actionTaken2 || 'hdvdc',
            actionTaken2By: inq.actionTaken2By || 'admin',
            actionTaken2Status: 'Follow Up',
            history: inq.history,
          }
        ).exec().catch(() => {});
      }
    });

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
      details2,
      details3,
      details4,
      remark,
      actionTaken1,
      actionTaken1Date,
      actionTaken1By,
      actionTaken1Status,
      actionTaken2,
      actionTaken2Date,
      actionTaken2By,
      actionTaken2Status,
      actionTaken3,
      actionTaken3Date,
      actionTaken3By,
      actionTaken3Status,
      actionTaken4,
      actionTaken4Date,
      actionTaken4By,
      actionTaken4Status,
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

    const act1 = actionTaken1 !== undefined ? actionTaken1.trim() : (remark ? remark.trim() : '');
    const act2 = actionTaken2 !== undefined ? actionTaken2.trim() : '';
    const act3 = actionTaken3 !== undefined ? actionTaken3.trim() : '';
    const act4 = actionTaken4 !== undefined ? actionTaken4.trim() : '';
    const effectiveRemark = act4 || act3 || act2 || act1 || (remark ? remark.trim() : '');

    const initialHistory: any[] = [];
    if (act1 || details) {
      initialHistory.push({
        callNumber: 1,
        subject: subject ? subject.trim() : '',
        details: details ? details.trim() : '',
        remark: act1 || (remark ? remark.trim() : ''),
        status: status || 'Follow Up',
        callType: callType || 'Enquiry',
        attendedBy: user.name,
        date: new Date(),
      });
    }
    if (act2 || details2) {
      initialHistory.push({
        callNumber: 2,
        subject: subject ? subject.trim() : '',
        details: details2 ? details2.trim() : '2nd Follow-up discussion',
        remark: act2,
        status: actionTaken2Status || status || 'Follow Up',
        callType: callType || 'Follow Up',
        attendedBy: actionTaken2By || user.name,
        date: actionTaken2Date ? new Date(actionTaken2Date) : new Date(),
      });
    }
    if (act3 || details3) {
      initialHistory.push({
        callNumber: 3,
        subject: subject ? subject.trim() : '',
        details: details3 ? details3.trim() : '3rd Follow-up discussion',
        remark: act3,
        status: actionTaken3Status || status || 'Follow Up',
        callType: callType || 'Follow Up',
        attendedBy: actionTaken3By || user.name,
        date: actionTaken3Date ? new Date(actionTaken3Date) : new Date(),
      });
    }
    if (act4 || details4) {
      initialHistory.push({
        callNumber: 4,
        subject: subject ? subject.trim() : '',
        details: details4 ? details4.trim() : '4th Follow-up discussion',
        remark: act4,
        status: actionTaken4Status || status || 'Follow Up',
        callType: callType || 'Follow Up',
        attendedBy: actionTaken4By || user.name,
        date: actionTaken4Date ? new Date(actionTaken4Date) : new Date(),
      });
    }
    if (initialHistory.length === 0) {
      initialHistory.push({
        callNumber: 1,
        subject: subject ? subject.trim() : '',
        details: details ? details.trim() : '',
        remark: effectiveRemark,
        status: status || 'Follow Up',
        callType: callType || 'Enquiry',
        attendedBy: user.name,
        date: new Date(),
      });
    }

    let previousInquiryRef: any = undefined;
    if (previousInquiryId && previousInquiryId.trim()) {
      const prevDoc = await StudentInquiry.findOne({
        inquiryId: previousInquiryId.trim().toUpperCase(),
      });
      if (prevDoc) {
        previousInquiryRef = prevDoc._id;
        // Sync history to parent doc
        if (!Array.isArray(prevDoc.history) || prevDoc.history.length === 0) {
          prevDoc.history = [
            {
              callNumber: 1,
              subject: prevDoc.subject || '',
              details: prevDoc.details || '',
              remark: prevDoc.actionTaken1 || prevDoc.remark || '',
              status: prevDoc.actionTaken1Status || prevDoc.status || 'Follow Up',
              callType: prevDoc.callType || 'Enquiry',
              attendedBy: prevDoc.actionTaken1By || prevDoc.addedByName || 'Staff',
              date: prevDoc.actionTaken1Date || prevDoc.createdAt || new Date(),
            },
          ];
        }
        prevDoc.history.push({
          callNumber: prevDoc.history.length + 1,
          subject: subject ? subject.trim() : prevDoc.subject,
          details: details ? details.trim() : 'Follow-up Call',
          remark: effectiveRemark,
          status: status || prevDoc.status || 'Follow Up',
          callType: callType || prevDoc.callType || 'Follow Up',
          attendedBy: user.name,
          date: new Date(),
        });

        // Also save follow-up details & notes to corresponding slot on parent doc without overwriting Call 1
        if (!prevDoc.actionTaken1 && prevDoc.remark) {
          prevDoc.actionTaken1 = prevDoc.remark;
          prevDoc.actionTaken1By = prevDoc.addedByName || 'Staff';
          prevDoc.actionTaken1Date = prevDoc.createdAt || new Date();
          prevDoc.actionTaken1Status = prevDoc.status || 'Follow Up';
        }

        const currentFollowUpNote = act4 || act3 || act2 || act1 || remark;
        const currentFollowUpDetails = details4 || details3 || details2 || (details ? details.trim() : '');

        if (act2 || details2) {
          prevDoc.details2 = details2 ? details2.trim() : (prevDoc.details2 || currentFollowUpDetails);
          prevDoc.actionTaken2 = act2 ? act2.trim() : prevDoc.actionTaken2;
          prevDoc.actionTaken2Date = actionTaken2Date ? new Date(actionTaken2Date) : (prevDoc.actionTaken2Date || new Date());
          prevDoc.actionTaken2By = actionTaken2By || prevDoc.actionTaken2By || user.name;
          prevDoc.actionTaken2Status = actionTaken2Status || status || prevDoc.status || 'Follow Up';
        }
        if (act3 || details3) {
          prevDoc.details3 = details3 ? details3.trim() : prevDoc.details3;
          prevDoc.actionTaken3 = act3 ? act3.trim() : prevDoc.actionTaken3;
          prevDoc.actionTaken3Date = actionTaken3Date ? new Date(actionTaken3Date) : (prevDoc.actionTaken3Date || new Date());
          prevDoc.actionTaken3By = actionTaken3By || prevDoc.actionTaken3By || user.name;
          prevDoc.actionTaken3Status = actionTaken3Status || status || prevDoc.status || 'Follow Up';
        }
        if (act4 || details4) {
          prevDoc.details4 = details4 ? details4.trim() : prevDoc.details4;
          prevDoc.actionTaken4 = act4 ? act4.trim() : prevDoc.actionTaken4;
          prevDoc.actionTaken4Date = actionTaken4Date ? new Date(actionTaken4Date) : (prevDoc.actionTaken4Date || new Date());
          prevDoc.actionTaken4By = actionTaken4By || prevDoc.actionTaken4By || user.name;
          prevDoc.actionTaken4Status = actionTaken4Status || status || prevDoc.status || 'Follow Up';
        }

        if (!act2 && !act3 && !act4 && (currentFollowUpNote || currentFollowUpDetails)) {
          if (!prevDoc.actionTaken2 && !prevDoc.details2) {
            prevDoc.details2 = currentFollowUpDetails;
            prevDoc.actionTaken2 = currentFollowUpNote;
            prevDoc.actionTaken2Date = new Date();
            prevDoc.actionTaken2By = user.name;
            prevDoc.actionTaken2Status = status || 'Follow Up';
          } else if (!prevDoc.actionTaken3 && !prevDoc.details3) {
            prevDoc.details3 = currentFollowUpDetails;
            prevDoc.actionTaken3 = currentFollowUpNote;
            prevDoc.actionTaken3Date = new Date();
            prevDoc.actionTaken3By = user.name;
            prevDoc.actionTaken3Status = status || 'Follow Up';
          } else if (!prevDoc.actionTaken4 && !prevDoc.details4) {
            prevDoc.details4 = currentFollowUpDetails;
            prevDoc.actionTaken4 = currentFollowUpNote;
            prevDoc.actionTaken4Date = new Date();
            prevDoc.actionTaken4By = user.name;
            prevDoc.actionTaken4Status = status || 'Follow Up';
          }
        }
        if (status) prevDoc.status = status;
        if (followUpDate) prevDoc.followUpDate = new Date(followUpDate);
        prevDoc.updatedAt = new Date();
        await prevDoc.save();
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
      details2: details2 ? details2.trim() : '',
      details3: details3 ? details3.trim() : '',
      details4: details4 ? details4.trim() : '',
      remark: effectiveRemark,
      actionTaken1: act1,
      actionTaken1Date: act1 ? (actionTaken1Date ? new Date(actionTaken1Date) : new Date()) : undefined,
      actionTaken1By: act1 ? (actionTaken1By || user.name) : '',
      actionTaken1Status: act1 ? (actionTaken1Status || status || 'Follow Up') : '',
      actionTaken2: act2,
      actionTaken2Date: act2 ? (actionTaken2Date ? new Date(actionTaken2Date) : new Date()) : undefined,
      actionTaken2By: act2 ? (actionTaken2By || user.name) : '',
      actionTaken2Status: act2 ? (actionTaken2Status || status || 'Follow Up') : '',
      actionTaken3: act3,
      actionTaken3Date: act3 ? (actionTaken3Date ? new Date(actionTaken3Date) : new Date()) : undefined,
      actionTaken3By: act3 ? (actionTaken3By || user.name) : '',
      actionTaken3Status: act3 ? (actionTaken3Status || status || 'Follow Up') : '',
      actionTaken4: act4,
      actionTaken4Date: act4 ? (actionTaken4Date ? new Date(actionTaken4Date) : new Date()) : undefined,
      actionTaken4By: act4 ? (actionTaken4By || user.name) : '',
      actionTaken4Status: act4 ? (actionTaken4Status || status || 'Follow Up') : '',
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
      history: initialHistory,
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
      attendedBy,
      dateFrom,
      dateTo,
      followUpDate,
      followUpDateFrom,
      followUpDateTo,
      followUpPreset,
      page = 1,
      limit = 50,
      sortBy = 'updatedAt',
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
        { remark: { $regex: s, $options: 'i' } },
        { actionTaken1: { $regex: s, $options: 'i' } },
        { actionTaken2: { $regex: s, $options: 'i' } },
        { actionTaken3: { $regex: s, $options: 'i' } },
        { actionTaken4: { $regex: s, $options: 'i' } },
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

    if (attendedBy && attendedBy !== 'ALL' && typeof attendedBy === 'string' && attendedBy.trim()) {
      const att = attendedBy.trim();
      const escapeReg = att.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const attRegex = new RegExp(escapeReg, 'i');
      
      const attendedCond = [
        { addedByName: { $regex: attRegex } },
        { forwardedTo: { $regex: attRegex } },
        { forwardedBy: { $regex: attRegex } },
      ];

      if (query.$or) {
        query.$and = query.$and || [];
        query.$and.push({ $or: query.$or });
        delete query.$or;
        query.$and.push({ $or: attendedCond });
      } else {
        query.$or = attendedCond;
      }
    }

    // Follow-Up Date Filters (Preset, Range, or Single Date)
    if (followUpPreset && typeof followUpPreset === 'string' && followUpPreset !== 'ALL') {
      const now = new Date();
      const istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const todayStart = new Date(`${istStr}T00:00:00.000+05:30`);
      const todayEnd = new Date(`${istStr}T23:59:59.999+05:30`);

      if (followUpPreset === 'TODAY') {
        const utcStart = new Date(todayStart.toISOString().split('T')[0] + 'T00:00:00.000Z');
        const utcEnd = new Date(todayEnd.toISOString().split('T')[0] + 'T23:59:59.999Z');
        query.followUpDate = {
          $gte: new Date(Math.min(todayStart.getTime(), utcStart.getTime())),
          $lte: new Date(Math.max(todayEnd.getTime(), utcEnd.getTime())),
        };
      } else if (followUpPreset === 'TOMORROW') {
        const tomStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        const tomEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
        query.followUpDate = { $gte: tomStart, $lte: tomEnd };
      } else if (followUpPreset === 'OVERDUE') {
        query.followUpDate = { $lt: todayStart, $ne: null };
        if (!status) query.status = 'Follow Up';
      } else if (followUpPreset === 'UPCOMING_7') {
        const next7End = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
        query.followUpDate = { $gte: todayStart, $lte: next7End };
      }
    } else if (followUpDateFrom || followUpDateTo) {
      query.followUpDate = {};
      if (followUpDateFrom) {
        const fStr = (followUpDateFrom as string).trim().split('T')[0];
        query.followUpDate.$gte = new Date(`${fStr}T00:00:00.000Z`);
      }
      if (followUpDateTo) {
        const tStr = (followUpDateTo as string).trim().split('T')[0];
        query.followUpDate.$lte = new Date(`${tStr}T23:59:59.999Z`);
      }
    } else if (followUpDate && typeof followUpDate === 'string' && followUpDate.trim() && followUpDate !== 'ALL') {
      const fDateStr = followUpDate.trim().split('T')[0];
      const istStart = new Date(`${fDateStr}T00:00:00.000+05:30`);
      const istEnd = new Date(`${fDateStr}T23:59:59.999+05:30`);
      const utcStart = new Date(`${fDateStr}T00:00:00.000Z`);
      const utcEnd = new Date(`${fDateStr}T23:59:59.999Z`);
      const minDate = istStart < utcStart ? istStart : utcStart;
      const maxDate = istEnd > utcEnd ? istEnd : utcEnd;
      query.followUpDate = { $gte: minDate, $lte: maxDate };
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
      else if (key === 'purchased' || key === 'purchases' || key === 'purchase') statsMap.purchases = st.count;
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
      details2,
      details3,
      details4,
      remark,
      actionTaken1,
      actionTaken1Date,
      actionTaken1By,
      actionTaken1Status,
      actionTaken2,
      actionTaken2Date,
      actionTaken2By,
      actionTaken2Status,
      actionTaken3,
      actionTaken3Date,
      actionTaken3By,
      actionTaken3Status,
      actionTaken4,
      actionTaken4Date,
      actionTaken4By,
      actionTaken4Status,
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
    if (details !== undefined && details.trim()) inquiry.details = details.trim();
    if (details2 !== undefined) inquiry.details2 = details2.trim();
    if (details3 !== undefined) inquiry.details3 = details3.trim();
    if (details4 !== undefined) inquiry.details4 = details4.trim();
    if (forwardedBy !== undefined) inquiry.forwardedBy = forwardedBy.trim();
    if (forwardedTo !== undefined) inquiry.forwardedTo = forwardedTo.trim();
    if (previousInquiryId !== undefined) inquiry.previousInquiryId = previousInquiryId.trim().toUpperCase();
    if (followUpDate !== undefined) inquiry.followUpDate = followUpDate ? new Date(followUpDate) : undefined;

    // Action Taken 1 to 4 updates
    const currentUserName = req.user?.name || 'Staff';
    if (actionTaken1 !== undefined) {
      inquiry.actionTaken1 = actionTaken1.trim();
      if (inquiry.actionTaken1 && !inquiry.actionTaken1Date) {
        inquiry.actionTaken1Date = actionTaken1Date ? new Date(actionTaken1Date) : new Date();
      }
      if (actionTaken1By) inquiry.actionTaken1By = actionTaken1By;
      else if (!inquiry.actionTaken1By && inquiry.actionTaken1) inquiry.actionTaken1By = currentUserName;
      if (actionTaken1Status) inquiry.actionTaken1Status = actionTaken1Status;
      else if (!inquiry.actionTaken1Status && inquiry.actionTaken1) inquiry.actionTaken1Status = status || inquiry.status;
    }
    if (actionTaken2 !== undefined) {
      const prevVal = inquiry.actionTaken2 || '';
      inquiry.actionTaken2 = actionTaken2.trim();
      if (inquiry.actionTaken2 && (inquiry.actionTaken2 !== prevVal || !inquiry.actionTaken2Date)) {
        inquiry.actionTaken2Date = actionTaken2Date ? new Date(actionTaken2Date) : new Date();
        inquiry.actionTaken2By = actionTaken2By || currentUserName;
        inquiry.actionTaken2Status = actionTaken2Status || status || inquiry.status;
      }
    }
    if (actionTaken3 !== undefined) {
      const prevVal = inquiry.actionTaken3 || '';
      inquiry.actionTaken3 = actionTaken3.trim();
      if (inquiry.actionTaken3 && (inquiry.actionTaken3 !== prevVal || !inquiry.actionTaken3Date)) {
        inquiry.actionTaken3Date = actionTaken3Date ? new Date(actionTaken3Date) : new Date();
        inquiry.actionTaken3By = actionTaken3By || currentUserName;
        inquiry.actionTaken3Status = actionTaken3Status || status || inquiry.status;
      }
    }
    if (actionTaken4 !== undefined) {
      const prevVal = inquiry.actionTaken4 || '';
      inquiry.actionTaken4 = actionTaken4.trim();
      if (inquiry.actionTaken4 && (inquiry.actionTaken4 !== prevVal || !inquiry.actionTaken4Date)) {
        inquiry.actionTaken4Date = actionTaken4Date ? new Date(actionTaken4Date) : new Date();
        inquiry.actionTaken4By = actionTaken4By || currentUserName;
        inquiry.actionTaken4Status = actionTaken4Status || status || inquiry.status;
      }
    }

    const latestRemark = inquiry.actionTaken4 || inquiry.actionTaken3 || inquiry.actionTaken2 || inquiry.actionTaken1 || (remark !== undefined ? remark.trim() : inquiry.remark);
    if (latestRemark !== undefined) {
      inquiry.remark = latestRemark;
    }

    if (status !== undefined) {
      inquiry.status = status;
      if (status === 'Solved' && !inquiry.resolvedAt) {
        inquiry.resolvedAt = new Date();
      }
    }

    // Maintain historical trail of every update
    if (!Array.isArray(inquiry.history) || inquiry.history.length === 0) {
      inquiry.history = [
        {
          callNumber: 1,
          subject: inquiry.subject || '',
          details: inquiry.details || '',
          remark: inquiry.actionTaken1 || inquiry.remark || '',
          status: inquiry.actionTaken1Status || inquiry.status || 'Follow Up',
          callType: inquiry.callType || 'Enquiry',
          attendedBy: inquiry.actionTaken1By || inquiry.addedByName || 'Staff',
          date: inquiry.actionTaken1Date || inquiry.createdAt || new Date(),
        },
      ];
    }

    inquiry.history.push({
      callNumber: inquiry.history.length + 1,
      subject: inquiry.subject || '',
      details: details !== undefined ? details.trim() : (inquiry.details || 'Follow-up update'),
      remark: latestRemark || '',
      status: inquiry.status || 'Follow Up',
      callType: inquiry.callType || 'Follow Up',
      attendedBy: currentUserName,
      date: new Date(),
    });

    // Force updatedAt touch
    inquiry.updatedAt = new Date();
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
      const rowData = Array(10).fill('');
      rowData[9] = formattedPhone;
      const payloadData = JSON.stringify({
        phoneNumber: formattedPhone,
        rowData,
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

/**
 * @desc    Get dynamic subject suggestions based on previous inquiries
 * @route   GET /api/student-inquiries/subject-suggestions
 * @access  Private (Support / Admin)
 */
export const getSubjectSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const search = String(req.query.q || req.query.search || '').trim();

    const matchStage: any = {
      subject: { $exists: true, $ne: '' },
    };

    if (search) {
      matchStage.subject = { $regex: search, $options: 'i' };
    }

    const results = await StudentInquiry.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $trim: { input: '$subject' } },
          count: { $sum: 1 },
          lastUsed: { $max: '$createdAt' },
        },
      },
      { $match: { _id: { $ne: '' } } },
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          count: 1,
        },
      },
    ]);

    res.json({
      success: true,
      suggestions: results,
    });
  } catch (error: any) {
    console.error('Error fetching subject suggestions:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch subject suggestions' });
  }
};

