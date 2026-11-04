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

const MAX_FOLLOW_UP_CALLS = 4;

const getCanonicalCallHistory = (inquiry: any) => {
  const history = Array.isArray(inquiry.history)
    ? inquiry.history.map((call: any, index: number) => ({
        ...call,
        callNumber: Number(call.callNumber) || index + 1,
      }))
    : [];

  for (let callNumber = 1; callNumber <= MAX_FOLLOW_UP_CALLS; callNumber += 1) {
    const remark = (inquiry[`actionTaken${callNumber}`] || '').trim();
    const existing = history.find((call: any) => call.callNumber === callNumber);
    if (existing) {
      if (!existing.remark && remark) existing.remark = remark;
      existing.details = existing.details || inquiry[callNumber === 1 ? 'details' : `details${callNumber}`] || '';
      existing.status = existing.status || inquiry[`actionTaken${callNumber}Status`] || inquiry.status || '';
      existing.attendedBy = existing.attendedBy || inquiry[`actionTaken${callNumber}By`] || inquiry.addedByName || '';
      existing.date = existing.date || inquiry[`actionTaken${callNumber}Date`] || inquiry.createdAt;
      continue;
    }
    if (remark) {
      history.push({
        callNumber,
        subject: inquiry.subject || '',
        details: inquiry[callNumber === 1 ? 'details' : `details${callNumber}`] || '',
        remark,
        status: inquiry[`actionTaken${callNumber}Status`] || inquiry.status || 'Follow Up',
        callType: callNumber === 1 ? inquiry.callType || 'Enquiry' : 'Follow Up',
        attendedBy: inquiry[`actionTaken${callNumber}By`] || inquiry.addedByName || 'Staff',
        date: inquiry[`actionTaken${callNumber}Date`] || inquiry.createdAt,
      });
    }
  }

  const summaryRemark = (inquiry.remark || '').trim();
  let call1 = history.find((call: any) => call.callNumber === 1);
  if (
    !call1 &&
    summaryRemark &&
    !history.some((call: any) => call.callNumber > 1) &&
    !inquiry.actionTaken2 &&
    !inquiry.actionTaken3 &&
    !inquiry.actionTaken4
  ) {
    call1 = {
      callNumber: 1,
      subject: inquiry.subject || '',
      details: inquiry.details || '',
      remark: summaryRemark,
      status: inquiry.status || 'Follow Up',
      callType: inquiry.callType || 'Enquiry',
      attendedBy: inquiry.addedByName || 'Staff',
      date: inquiry.createdAt,
    };
    history.push(call1);
  }
  const hasLaterCall = history.some((call: any) => call.callNumber > 1 && call.remark);
  if (
    call1?.remark &&
    !hasLaterCall &&
    summaryRemark &&
    summaryRemark !== call1.remark.trim()
  ) {
    history.push({
      callNumber: 2,
      subject: inquiry.subject || '',
      details: inquiry.details2 || '2nd Follow-up discussion',
      remark: summaryRemark,
      status: inquiry.status || 'Follow Up',
      callType: 'Follow Up',
      attendedBy: inquiry.addedByName || 'Staff',
      date: inquiry.updatedAt || inquiry.createdAt,
    });
  }

  return history.sort((a: any, b: any) => a.callNumber - b.callNumber);
};

const callHistoryNeedsMigration = (stored: any[], canonical: any[]) =>
  stored.length !== canonical.length ||
  stored.some((call, index) => {
    const normalized = canonical[index];
    return (
      call.callNumber !== normalized.callNumber ||
      call.subject !== normalized.subject ||
      call.remark !== normalized.remark ||
      call.details !== normalized.details ||
      call.status !== normalized.status ||
      call.callType !== normalized.callType ||
      call.attendedBy !== normalized.attendedBy ||
      new Date(call.date || 0).getTime() !== new Date(normalized.date || 0).getTime()
    );
  });

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

    // Consolidate remarks across inquiries for this phone number
    pastInquiries.forEach((inq: any) => {
      // General slot recovery from history if not explicitly populated
      if (!inq.actionTaken1) {
        const h1 = Array.isArray(inq.history) ? inq.history.find((h: any) => h.callNumber === 1) : null;
        if (h1 && h1.remark) {
          inq.actionTaken1 = h1.remark;
          inq.actionTaken1Date = h1.date || inq.createdAt;
          inq.actionTaken1By = h1.attendedBy || inq.addedByName || 'Staff';
          inq.actionTaken1Status = h1.status || inq.status || 'Follow Up';
        } else if (inq.remark && !inq.actionTaken2) {
          inq.actionTaken1 = inq.remark;
          inq.actionTaken1Date = inq.createdAt || new Date();
          inq.actionTaken1By = inq.addedByName || 'Staff';
          inq.actionTaken1Status = inq.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken2 && Array.isArray(inq.history)) {
        const h2 = inq.history.find((h: any) => h.callNumber === 2);
        if (h2 && h2.remark) {
          inq.actionTaken2 = h2.remark;
          inq.actionTaken2Date = h2.date;
          inq.actionTaken2By = h2.attendedBy || 'Staff';
          inq.actionTaken2Status = h2.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken3 && Array.isArray(inq.history)) {
        const h3 = inq.history.find((h: any) => h.callNumber === 3);
        if (h3 && h3.remark) {
          inq.actionTaken3 = h3.remark;
          inq.actionTaken3Date = h3.date;
          inq.actionTaken3By = h3.attendedBy || 'Staff';
          inq.actionTaken3Status = h3.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken4 && Array.isArray(inq.history)) {
        const h4 = inq.history.find((h: any) => h.callNumber === 4);
        if (h4 && h4.remark) {
          inq.actionTaken4 = h4.remark;
          inq.actionTaken4Date = h4.date;
          inq.actionTaken4By = h4.attendedBy || 'Staff';
          inq.actionTaken4Status = h4.status || 'Follow Up';
        }
      }

      const hasLaterCall =
        inq.actionTaken2 ||
        inq.actionTaken3 ||
        inq.actionTaken4 ||
        (Array.isArray(inq.history) && inq.history.some((call: any) => call.callNumber > 1 && call.remark));
      const latestRemark = (inq.remark || '').trim();
      if (
        inq.actionTaken1 &&
        !hasLaterCall &&
        latestRemark &&
        latestRemark !== inq.actionTaken1.trim()
      ) {
        inq.actionTaken2 = latestRemark;
        inq.actionTaken2Date = inq.updatedAt || inq.createdAt;
        inq.actionTaken2By = inq.addedByName || 'Staff';
        inq.actionTaken2Status = inq.status || 'Follow Up';
      }
    });

    // Multi-inquiry consolidation: collect chronological calls across all records for this student
    if (pastInquiries.length > 0) {
      const chronInqs = [...pastInquiries].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const rootInq = chronInqs[0];

      // Collect all call entries
      const allCalls: Array<{
        callNumber: number;
        remark: string;
        date?: Date;
        attendedBy?: string;
        status?: string;
        details?: string;
      }> = [];

      chronInqs.forEach((item: any) => {
        const hList = Array.isArray(item.history) ? item.history : [];
        if (item.actionTaken1) {
          allCalls.push({
            callNumber: 1,
            remark: item.actionTaken1,
            date: item.actionTaken1Date || item.createdAt,
            attendedBy: item.actionTaken1By || item.addedByName,
            status: item.actionTaken1Status || item.status,
            details: item.details,
          });
        } else if (hList[0]?.remark) {
          allCalls.push({
            callNumber: Number(hList[0].callNumber) || 1,
            remark: hList[0].remark,
            date: hList[0].date,
            attendedBy: hList[0].attendedBy,
            status: hList[0].status,
            details: hList[0].details,
          });
        } else if (item.remark) {
          allCalls.push({
            callNumber: 1,
            remark: item.remark,
            date: item.createdAt,
            attendedBy: item.addedByName,
            status: item.status,
            details: item.details,
          });
        }

        if (item.actionTaken2) {
          allCalls.push({
            callNumber: 2,
            remark: item.actionTaken2,
            date: item.actionTaken2Date || item.updatedAt,
            attendedBy: item.actionTaken2By,
            status: item.actionTaken2Status,
            details: item.details2,
          });
        } else if (hList[1]?.remark) {
          allCalls.push({
            callNumber: Number(hList[1].callNumber) || 2,
            remark: hList[1].remark,
            date: hList[1].date,
            attendedBy: hList[1].attendedBy,
            status: hList[1].status,
            details: hList[1].details,
          });
        }

        if (item.actionTaken3) {
          allCalls.push({
            callNumber: 3,
            remark: item.actionTaken3,
            date: item.actionTaken3Date,
            attendedBy: item.actionTaken3By,
            status: item.actionTaken3Status,
            details: item.details3,
          });
        } else if (hList[2]?.remark) {
          allCalls.push({
            callNumber: Number(hList[2].callNumber) || 3,
            remark: hList[2].remark,
            date: hList[2].date,
            attendedBy: hList[2].attendedBy,
            status: hList[2].status,
            details: hList[2].details,
          });
        }

        if (item.actionTaken4) {
          allCalls.push({
            callNumber: 4,
            remark: item.actionTaken4,
            date: item.actionTaken4Date,
            attendedBy: item.actionTaken4By,
            status: item.actionTaken4Status,
            details: item.details4,
          });
        } else if (hList[3]?.remark) {
          allCalls.push({
            callNumber: Number(hList[3].callNumber) || 4,
            remark: hList[3].remark,
            date: hList[3].date,
            attendedBy: hList[3].attendedBy,
            status: hList[3].status,
            details: hList[3].details,
          });
        }
      });

      const callsByNumber = new Map<number, typeof allCalls>();
      allCalls.forEach((call) => {
        const callNumber = Number(call.callNumber);
        const text = (call.remark || '').trim();
        if (!text || callNumber < 1 || callNumber > 4) return;
        const calls = callsByNumber.get(callNumber) || [];
        const duplicate = calls.some((existing) =>
          existing.remark.trim().toLowerCase() === text.toLowerCase() &&
          new Date(existing.date || 0).getTime() === new Date(call.date || 0).getTime()
        );
        if (!duplicate) calls.push(call);
        callsByNumber.set(callNumber, calls);
      });

      const callsBySlot = [1, 2, 3, 4].map((callNumber) =>
        (callsByNumber.get(callNumber) || []).sort(
          (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        )[0]
      );

      if (callsBySlot[0]) {
        rootInq.actionTaken1 = callsBySlot[0].remark;
        rootInq.actionTaken1Date = callsBySlot[0].date;
        rootInq.actionTaken1By = callsBySlot[0].attendedBy;
        rootInq.actionTaken1Status = callsBySlot[0].status;
      }
      if (callsBySlot[1]) {
        rootInq.actionTaken2 = callsBySlot[1].remark;
        rootInq.actionTaken2Date = callsBySlot[1].date;
        rootInq.actionTaken2By = callsBySlot[1].attendedBy;
        rootInq.actionTaken2Status = callsBySlot[1].status;
      }
      if (callsBySlot[2]) {
        rootInq.actionTaken3 = callsBySlot[2].remark;
        rootInq.actionTaken3Date = callsBySlot[2].date;
        rootInq.actionTaken3By = callsBySlot[2].attendedBy;
        rootInq.actionTaken3Status = callsBySlot[2].status;
      }
      if (callsBySlot[3]) {
        rootInq.actionTaken4 = callsBySlot[3].remark;
        rootInq.actionTaken4Date = callsBySlot[3].date;
        rootInq.actionTaken4By = callsBySlot[3].attendedBy;
        rootInq.actionTaken4Status = callsBySlot[3].status;
      }
      if (callsBySlot.some(Boolean)) {
        rootInq.remark =
          rootInq.actionTaken4 ||
          rootInq.actionTaken3 ||
          rootInq.actionTaken2 ||
          rootInq.actionTaken1 ||
          rootInq.remark;

        // Persist consolidated slots into root inquiry
        StudentInquiry.updateOne(
          { _id: rootInq._id },
          {
            $set: {
              actionTaken1: rootInq.actionTaken1 || '',
              actionTaken1Date: rootInq.actionTaken1Date,
              actionTaken1By: rootInq.actionTaken1By || '',
              actionTaken1Status: rootInq.actionTaken1Status || '',
              actionTaken2: rootInq.actionTaken2 || '',
              actionTaken2Date: rootInq.actionTaken2Date,
              actionTaken2By: rootInq.actionTaken2By || '',
              actionTaken2Status: rootInq.actionTaken2Status || '',
              actionTaken3: rootInq.actionTaken3 || '',
              actionTaken3Date: rootInq.actionTaken3Date,
              actionTaken3By: rootInq.actionTaken3By || '',
              actionTaken3Status: rootInq.actionTaken3Status || '',
              actionTaken4: rootInq.actionTaken4 || '',
              actionTaken4Date: rootInq.actionTaken4Date,
              actionTaken4By: rootInq.actionTaken4By || '',
              actionTaken4Status: rootInq.actionTaken4Status || '',
              remark: rootInq.remark,
            },
          }
        ).exec().catch(() => {});
      }
    }

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
    if (previousInquiryId && previousInquiryId.trim() && previousInquiryId.trim().toUpperCase() !== 'CUSTOM') {
      const cleanPrevId = previousInquiryId.trim().toUpperCase().replace(/[^a-zA-Z0-9-]/g, '');
      const prevDoc = await StudentInquiry.findOne({
        inquiryId: new RegExp('^' + cleanPrevId + '$', 'i'),
      });
      if (prevDoc) {
        const existingCalls = getCanonicalCallHistory(prevDoc.toObject());
        if (existingCalls.length >= MAX_FOLLOW_UP_CALLS) {
          return res.status(409).json({ message: 'Maximum 4 follow-up calls reached.' });
        }
        const occupiedCallNumbers = new Set(existingCalls.map((call: any) => call.callNumber));
        const nextCallNumber = [1, 2, 3, 4].find((number) => !occupiedCallNumbers.has(number));
        if (!nextCallNumber) {
          return res.status(409).json({ message: 'Maximum 4 follow-up calls reached.' });
        }

        const submittedSlots = [actionTaken1, actionTaken2, actionTaken3, actionTaken4];
        const submittedRemark = typeof submittedSlots[nextCallNumber - 1] === 'string'
          ? submittedSlots[nextCallNumber - 1].trim()
          : '';
        const changedRemark = submittedSlots.find((slot, index) => {
          if (typeof slot !== 'string' || !slot.trim()) return false;
          const previous = (prevDoc as any)[`actionTaken${index + 1}`] || '';
          return slot.trim() !== previous.trim();
        });
        const followUpRemark = submittedRemark || (typeof changedRemark === 'string' ? changedRemark.trim() : '') ||
          (remark && remark.trim() !== (prevDoc.remark || '').trim() ? remark.trim() : '');
        if (!followUpRemark) {
          return res.status(400).json({ message: `Enter the Call #${nextCallNumber} remark before saving.` });
        }

        req.params.id = prevDoc._id.toString();
        req.body = {
          requestId: req.body.requestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          remark: followUpRemark,
          details: req.body[`details${nextCallNumber}`] || details || '',
          subject: subject || prevDoc.subject || '',
          status: status || 'Follow Up',
        };
        return appendStudentInquiryFollowUp(req, res);

        // Auto-heal legacy inquiry if actionTaken1 was not set, but remark had initial note
        if (!prevDoc.actionTaken1) {
          const h1 = Array.isArray(prevDoc.history) ? prevDoc.history.find((h: any) => h.callNumber === 1) : null;
          const hasLaterHistory = Array.isArray(prevDoc.history) && prevDoc.history.some((h: any) => h.callNumber > 1 && h.remark);
          if (h1 && h1.remark) {
            prevDoc.actionTaken1 = h1.remark;
            prevDoc.actionTaken1Date = h1.date || prevDoc.createdAt;
            prevDoc.actionTaken1By = h1.attendedBy || prevDoc.addedByName || user.name;
            prevDoc.actionTaken1Status = h1.status || prevDoc.status || 'Follow Up';
          } else if (prevDoc.remark && !prevDoc.actionTaken2 && !prevDoc.actionTaken3 && !prevDoc.actionTaken4 && !hasLaterHistory) {
            prevDoc.actionTaken1 = prevDoc.remark;
            prevDoc.actionTaken1Date = prevDoc.createdAt || new Date();
            prevDoc.actionTaken1By = prevDoc.addedByName || user.name;
            prevDoc.actionTaken1Status = prevDoc.status || 'Follow Up';
          }
        }

        const existing1 = (prevDoc.actionTaken1 || '').trim();
        const in1 = actionTaken1 !== undefined ? actionTaken1.trim() : '';
        const in2 = actionTaken2 !== undefined ? actionTaken2.trim() : '';
        const in3 = actionTaken3 !== undefined ? actionTaken3.trim() : '';
        const in4 = actionTaken4 !== undefined ? actionTaken4.trim() : '';

        prevDoc.actionTaken1 = in1 || existing1;
        if (prevDoc.actionTaken1 && !prevDoc.actionTaken1Date) {
          prevDoc.actionTaken1Date = actionTaken1Date ? new Date(actionTaken1Date) : new Date();
        }
        if (actionTaken1By) prevDoc.actionTaken1By = actionTaken1By;

        if (in2) {
          prevDoc.actionTaken2 = in2;
          prevDoc.actionTaken2Date = actionTaken2Date ? new Date(actionTaken2Date) : new Date();
          prevDoc.actionTaken2By = actionTaken2By || user.name;
          prevDoc.actionTaken2Status = actionTaken2Status || status || 'Follow Up';
        }
        if (in3) {
          prevDoc.actionTaken3 = in3;
          prevDoc.actionTaken3Date = actionTaken3Date ? new Date(actionTaken3Date) : new Date();
          prevDoc.actionTaken3By = actionTaken3By || user.name;
          prevDoc.actionTaken3Status = actionTaken3Status || status || 'Follow Up';
        }
        if (in4) {
          prevDoc.actionTaken4 = in4;
          prevDoc.actionTaken4Date = actionTaken4Date ? new Date(actionTaken4Date) : new Date();
          prevDoc.actionTaken4By = actionTaken4By || user.name;
          prevDoc.actionTaken4Status = actionTaken4Status || status || 'Follow Up';
        }

        if (studentName) prevDoc.studentName = studentName.trim();
        if (alternateNumber) prevDoc.alternateNumber = alternateNumber.trim();
        if (email) prevDoc.email = email.trim();
        if (subject) prevDoc.subject = subject.trim();
        if (details) prevDoc.details = details.trim();
        if (details2) prevDoc.details2 = details2.trim();
        if (details3) prevDoc.details3 = details3.trim();
        if (details4) prevDoc.details4 = details4.trim();
        if (status) prevDoc.status = status;
        if (callType) prevDoc.callType = callType;
        if (forwardedBy) prevDoc.forwardedBy = forwardedBy.trim();
        if (forwardedTo) prevDoc.forwardedTo = forwardedTo.trim();
        if (followUpDate) prevDoc.followUpDate = new Date(followUpDate);
        if (status === 'Solved') prevDoc.resolvedAt = new Date();

        const latestRefRemark =
          prevDoc.actionTaken4 ||
          prevDoc.actionTaken3 ||
          prevDoc.actionTaken2 ||
          prevDoc.actionTaken1 ||
          effectiveRemark ||
          prevDoc.remark ||
          '';
        prevDoc.remark = latestRefRemark;
        prevDoc.updatedAt = new Date();

        // Synchronize full call history by callNumber
        if (!Array.isArray(prevDoc.history)) {
          prevDoc.history = [];
        }

        // Call 1
        const idx1 = prevDoc.history.findIndex((h: any) => h.callNumber === 1);
        const call1Obj = {
          callNumber: 1,
          subject: prevDoc.subject || '',
          details: prevDoc.details || 'Initial inquiry discussion',
          remark: prevDoc.actionTaken1 || prevDoc.remark || '',
          status: prevDoc.actionTaken1Status || prevDoc.status || 'Follow Up',
          callType: prevDoc.callType || 'Enquiry',
          attendedBy: prevDoc.actionTaken1By || prevDoc.addedByName || user.name,
          date: prevDoc.actionTaken1Date || prevDoc.createdAt || new Date(),
        };
        if (idx1 >= 0) {
          prevDoc.history[idx1] = { ...prevDoc.history[idx1], ...call1Obj };
        } else {
          prevDoc.history.unshift(call1Obj);
        }

        // Call 2
        if (prevDoc.actionTaken2) {
          const idx2 = prevDoc.history.findIndex((h: any) => h.callNumber === 2);
          const call2Obj = {
            callNumber: 2,
            subject: prevDoc.subject || '',
            details: prevDoc.details2 || details2 || '2nd Follow-up discussion',
            remark: prevDoc.actionTaken2,
            status: prevDoc.actionTaken2Status || prevDoc.status || 'Follow Up',
            callType: 'Follow Up',
            attendedBy: prevDoc.actionTaken2By || user.name,
            date: prevDoc.actionTaken2Date || new Date(),
          };
          if (idx2 >= 0) {
            prevDoc.history[idx2] = { ...prevDoc.history[idx2], ...call2Obj };
          } else {
            prevDoc.history.push(call2Obj);
          }
        }

        // Call 3
        if (prevDoc.actionTaken3) {
          const idx3 = prevDoc.history.findIndex((h: any) => h.callNumber === 3);
          const call3Obj = {
            callNumber: 3,
            subject: prevDoc.subject || '',
            details: prevDoc.details3 || details3 || '3rd Follow-up discussion',
            remark: prevDoc.actionTaken3,
            status: prevDoc.actionTaken3Status || prevDoc.status || 'Follow Up',
            callType: 'Follow Up',
            attendedBy: prevDoc.actionTaken3By || user.name,
            date: prevDoc.actionTaken3Date || new Date(),
          };
          if (idx3 >= 0) {
            prevDoc.history[idx3] = { ...prevDoc.history[idx3], ...call3Obj };
          } else {
            prevDoc.history.push(call3Obj);
          }
        }

        // Call 4
        if (prevDoc.actionTaken4) {
          const idx4 = prevDoc.history.findIndex((h: any) => h.callNumber === 4);
          const call4Obj = {
            callNumber: 4,
            subject: prevDoc.subject || '',
            details: prevDoc.details4 || details4 || '4th Follow-up discussion',
            remark: prevDoc.actionTaken4,
            status: prevDoc.actionTaken4Status || prevDoc.status || 'Follow Up',
            callType: 'Follow Up',
            attendedBy: prevDoc.actionTaken4By || user.name,
            date: prevDoc.actionTaken4Date || new Date(),
          };
          if (idx4 >= 0) {
            prevDoc.history[idx4] = { ...prevDoc.history[idx4], ...call4Obj };
          } else {
            prevDoc.history.push(call4Obj);
          }
        }

        prevDoc.markModified('history');
        await prevDoc.save();

        await StudentInquiry.updateOne(
          { _id: prevDoc._id },
          {
            $set: {
              actionTaken1: prevDoc.actionTaken1 || '',
              actionTaken1Date: prevDoc.actionTaken1Date,
              actionTaken1By: prevDoc.actionTaken1By || '',
              actionTaken1Status: prevDoc.actionTaken1Status || '',
              actionTaken2: prevDoc.actionTaken2 || '',
              actionTaken2Date: prevDoc.actionTaken2Date,
              actionTaken2By: prevDoc.actionTaken2By || '',
              actionTaken2Status: prevDoc.actionTaken2Status || '',
              actionTaken3: prevDoc.actionTaken3 || '',
              actionTaken3Date: prevDoc.actionTaken3Date,
              actionTaken3By: prevDoc.actionTaken3By || '',
              actionTaken3Status: prevDoc.actionTaken3Status || '',
              actionTaken4: prevDoc.actionTaken4 || '',
              actionTaken4Date: prevDoc.actionTaken4Date,
              actionTaken4By: prevDoc.actionTaken4By || '',
              actionTaken4Status: prevDoc.actionTaken4Status || '',
              remark: prevDoc.remark,
              history: prevDoc.history,
              status: prevDoc.status,
              callType: prevDoc.callType,
              subject: prevDoc.subject,
              details: prevDoc.details,
              details2: prevDoc.details2,
              details3: prevDoc.details3,
              details4: prevDoc.details4,
              updatedAt: new Date(),
            },
          }
        );

        const populated = await StudentInquiry.findById(prevDoc._id)
          .populate('addedBy', 'name email department designation')
          .populate('previousInquiryRef', 'inquiryId studentName status subject details')
          .lean();

        return res.status(200).json({
          success: true,
          message: `Inquiry ${prevDoc.inquiryId} updated with linked follow-up successfully.`,
          inquiry: populated || prevDoc,
        });
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

    inquiries.forEach((inq: any) => {
      if (!inq.actionTaken1) {
        const h1 = Array.isArray(inq.history) ? inq.history.find((h: any) => h.callNumber === 1) : null;
        if (h1 && h1.remark) {
          inq.actionTaken1 = h1.remark;
          inq.actionTaken1Date = h1.date || inq.createdAt;
          inq.actionTaken1By = h1.attendedBy || inq.addedByName || 'Staff';
          inq.actionTaken1Status = h1.status || inq.status || 'Follow Up';
        } else if (inq.remark && !inq.actionTaken2) {
          inq.actionTaken1 = inq.remark;
          inq.actionTaken1Date = inq.createdAt;
          inq.actionTaken1By = inq.addedByName || 'Staff';
          inq.actionTaken1Status = inq.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken2 && Array.isArray(inq.history)) {
        const h2 = inq.history.find((h: any) => h.callNumber === 2);
        if (h2 && h2.remark) {
          inq.actionTaken2 = h2.remark;
          inq.actionTaken2Date = h2.date;
          inq.actionTaken2By = h2.attendedBy || 'Staff';
          inq.actionTaken2Status = h2.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken3 && Array.isArray(inq.history)) {
        const h3 = inq.history.find((h: any) => h.callNumber === 3);
        if (h3 && h3.remark) {
          inq.actionTaken3 = h3.remark;
          inq.actionTaken3Date = h3.date;
          inq.actionTaken3By = h3.attendedBy || 'Staff';
          inq.actionTaken3Status = h3.status || 'Follow Up';
        }
      }
      if (!inq.actionTaken4 && Array.isArray(inq.history)) {
        const h4 = inq.history.find((h: any) => h.callNumber === 4);
        if (h4 && h4.remark) {
          inq.actionTaken4 = h4.remark;
          inq.actionTaken4Date = h4.date;
          inq.actionTaken4By = h4.attendedBy || 'Staff';
          inq.actionTaken4Status = h4.status || 'Follow Up';
        }
      }
    });

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
 * @desc    Append a follow-up call to the existing main inquiry
 * @route   POST /api/student-inquiries/:id/follow-ups
 * @access  Private (Support & Admin)
 */
export const appendStudentInquiryFollowUp = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const remark = typeof req.body.remark === 'string' ? req.body.remark.trim() : '';
    const details = typeof req.body.details === 'string' ? req.body.details.trim() : '';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
    const status = typeof req.body.status === 'string' ? req.body.status.trim() : 'Follow Up';
    const requestId = typeof req.body.requestId === 'string' ? req.body.requestId.trim() : '';

    if (!remark || !requestId || requestId.length > 128) {
      return res.status(400).json({ message: 'A remark and valid request ID are required.' });
    }

    let mainId = id;
    const visited = new Set<string>();
    let inquiry: any = null;
    for (let depth = 0; depth < 10; depth += 1) {
      if (visited.has(mainId)) break;
      visited.add(mainId);
      inquiry = await StudentInquiry.findById(mainId).lean();
      if (!inquiry) break;

      const parentId = inquiry.previousInquiryRef
        ? inquiry.previousInquiryRef.toString()
        : inquiry.previousInquiryId && inquiry.previousInquiryId !== 'CUSTOM'
          ? (await StudentInquiry.findOne({ inquiryId: inquiry.previousInquiryId }, { _id: 1 }).lean())?._id?.toString()
          : undefined;
      if (!parentId || parentId === inquiry._id.toString()) break;
      mainId = parentId;
    }

    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found.' });
    let mainInquiry: any = await StudentInquiry.findById(mainId).lean();
    if (!mainInquiry) return res.status(404).json({ message: 'Main inquiry not found.' });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const storedHistory = Array.isArray(mainInquiry.history) ? mainInquiry.history : [];
      const duplicate = storedHistory.find((call: any) => call.requestId === requestId);
      if (duplicate) {
        return res.status(200).json({ success: true, duplicate: true, call: duplicate, inquiry: mainInquiry });
      }

      const callHistory = getCanonicalCallHistory(mainInquiry);
      if (callHistory.length >= MAX_FOLLOW_UP_CALLS) {
        return res.status(409).json({ message: 'Maximum 4 follow-up calls reached.' });
      }

      if (!Array.isArray(mainInquiry.history) || callHistoryNeedsMigration(storedHistory, callHistory)) {
        const migrationFilter: any = { _id: mainInquiry._id };
        if (mainInquiry.updatedAt) migrationFilter.updatedAt = mainInquiry.updatedAt;
        migrationFilter.history = Array.isArray(mainInquiry.history)
          ? { $size: storedHistory.length }
          : mainInquiry.history === null
            ? null
            : { $exists: false };
        const migration = await StudentInquiry.updateOne(migrationFilter, { $set: { history: callHistory } });
        if (migration.modifiedCount === 0) {
          const refreshed = await StudentInquiry.findById(mainInquiry._id).lean();
          if (!refreshed) return res.status(404).json({ message: 'Main inquiry not found.' });
          mainInquiry = refreshed;
          continue;
        }
        const refreshed = await StudentInquiry.findById(mainInquiry._id).lean();
        if (!refreshed) return res.status(404).json({ message: 'Main inquiry not found.' });
        mainInquiry = refreshed;
        continue;
      }

      const occupiedCallNumbers = new Set(callHistory.map((call: any) => call.callNumber));
      const callNumber = [1, 2, 3, 4].find((number) => !occupiedCallNumbers.has(number));
      if (!callNumber) return res.status(409).json({ message: 'Maximum 4 follow-up calls reached.' });

      const date = new Date();
      const attendedBy = req.user?.name || 'Staff';
      const call = {
        callNumber,
        subject: subject || mainInquiry.subject || '',
        details,
        remark,
        status: status || 'Follow Up',
        callType: 'Follow Up',
        attendedBy,
        date,
        requestId,
      };
      const updateFilter: any = { _id: mainInquiry._id };
      updateFilter.history = Array.isArray(mainInquiry.history)
        ? { $size: storedHistory.length }
        : mainInquiry.history === null
          ? null
          : { $exists: false };
      if (mainInquiry.updatedAt) updateFilter.updatedAt = mainInquiry.updatedAt;

      const updates: Record<string, any> = {
        remark,
        updatedAt: date,
        [`actionTaken${callNumber}`]: remark,
        [`actionTaken${callNumber}Date`]: date,
        [`actionTaken${callNumber}By`]: attendedBy,
        [`actionTaken${callNumber}Status`]: call.status,
      };
      if (callNumber > 1) updates[`details${callNumber}`] = details;

      const updatedInquiry = await StudentInquiry.findOneAndUpdate(
        updateFilter,
        { $push: { history: call }, $set: updates },
        { new: true, runValidators: true }
      ).lean();

      if (updatedInquiry) {
        return res.status(200).json({ success: true, call, inquiry: updatedInquiry });
      }

      const refreshed = await StudentInquiry.findById(mainInquiry._id).lean();
      if (!refreshed) return res.status(404).json({ message: 'Main inquiry not found.' });
      const repeatedCall = Array.isArray(refreshed.history)
        ? refreshed.history.find((entry: any) => entry.requestId === requestId)
        : undefined;
      if (repeatedCall) {
        return res.status(200).json({ success: true, duplicate: true, call: repeatedCall, inquiry: refreshed });
      }
      mainInquiry = refreshed;
    }

    return res.status(409).json({ message: 'Inquiry changed while saving. Refresh and try again.' });
  } catch (error: any) {
    console.error('Error appending student inquiry follow-up:', error);
    return res.status(500).json({ message: error.message || 'Failed to save follow-up' });
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

    if (status !== undefined) {
      inquiry.status = status;
      if (status === 'Solved' && !inquiry.resolvedAt) {
        inquiry.resolvedAt = new Date();
      }
    }

    // Force updatedAt touch
    inquiry.updatedAt = new Date();
    await inquiry.save();

    const savedDoc = await StudentInquiry.findById(inquiry._id)
      .populate('addedBy', 'name email department designation')
      .lean();

    res.json({
      success: true,
      message: 'Inquiry updated successfully',
      inquiry: savedDoc || inquiry,
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

/**
 * @desc    Get purchased inquiries statistics grouped by IT & Support staff
 * @route   GET /api/student-inquiries/purchased-stats
 * @access  Private (Support / Admin)
 */
export const getPurchasedStaffStats = async (req: AuthRequest, res: Response) => {
  try {
    const User = (await import('../models/User')).default;

    const targetDate = req.query.date ? String(req.query.date) : undefined;
    const targetMonth = req.query.month ? String(req.query.month) : undefined;

    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffset);

    const tYear = istNow.getUTCFullYear();
    const tMonth = istNow.getUTCMonth();
    const tDay = istNow.getUTCDate();

    let startOfToday = new Date(Date.UTC(tYear, tMonth, tDay, 0, 0, 0) - istOffset);
    let endOfToday = new Date(Date.UTC(tYear, tMonth, tDay, 23, 59, 59, 999) - istOffset);

    if (targetDate) {
      const p = new Date(targetDate);
      if (!isNaN(p.getTime())) {
        const pIst = new Date(p.getTime() + istOffset);
        startOfToday = new Date(Date.UTC(pIst.getUTCFullYear(), pIst.getUTCMonth(), pIst.getUTCDate(), 0, 0, 0) - istOffset);
        endOfToday = new Date(Date.UTC(pIst.getUTCFullYear(), pIst.getUTCMonth(), pIst.getUTCDate(), 23, 59, 59, 999) - istOffset);
      }
    }

    let startOfMonth = new Date(Date.UTC(tYear, tMonth, 1, 0, 0, 0) - istOffset);
    let endOfMonth = new Date(Date.UTC(tYear, tMonth + 1, 1, 0, 0, 0) - istOffset);

    if (targetMonth && targetMonth.includes('-')) {
      const parts = targetMonth.split('-');
      const mY = Number(parts[0]);
      const mM = Number(parts[1]);
      if (mY && mM) {
        startOfMonth = new Date(Date.UTC(mY, mM - 1, 1, 0, 0, 0) - istOffset);
        endOfMonth = new Date(Date.UTC(mY, mM, 1, 0, 0, 0) - istOffset);
      }
    }

    // 1. Fetch all IT & Support staff users from DB
    const allUsers = await User.find({
      isActive: true,
      name: { $nin: [/^unknown$/i, '', null] },
    })
      .select('_id name email department designation role profileImage')
      .lean();

    const normalizeStaffCategory = (value: string) =>
      value.toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
    const isItSupportCategory = (value: string) =>
      ['it', 'it support', 'it and support', 'information technology', 'support'].includes(
        normalizeStaffCategory(value)
      );
    const itSupportStaff = allUsers.filter((user: any) =>
      isItSupportCategory(user.department || '') || isItSupportCategory(user.designation || '')
    );

    // 2. Fetch all inquiries that are marked as Purchased
    const purchasedInquiries = await StudentInquiry.find({
      $or: [
        { status: 'Purchased' },
        { callType: 'Purchased' },
        { actionTaken1Status: 'Purchased' },
        { actionTaken2Status: 'Purchased' },
        { actionTaken3Status: 'Purchased' },
        { actionTaken4Status: 'Purchased' },
      ],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    // 3. Map staff member stats
    const staffStatsMap = new Map<string, any>();

    itSupportStaff.forEach((s: any) => {
      staffStatsMap.set(s.name.toLowerCase().trim(), {
        _id: s._id,
        name: s.name,
        email: s.email,
        department: s.department || 'IT and support',
        designation: s.designation || 'IT Support',
        profileImage: s.profileImage,
        totalPurchased: 0,
        todayPurchased: 0,
        monthPurchased: 0,
        inquiries: [],
      });
    });

    purchasedInquiries.forEach((inq: any) => {
      const handlerName = (
        inq.forwardedTo ||
        (inq.actionTaken4Status === 'Purchased' ? inq.actionTaken4By : '') ||
        (inq.actionTaken3Status === 'Purchased' ? inq.actionTaken3By : '') ||
        (inq.actionTaken2Status === 'Purchased' ? inq.actionTaken2By : '') ||
        (inq.actionTaken1Status === 'Purchased' ? inq.actionTaken1By : '') ||
        inq.addedByName ||
        'Staff'
      ).trim();

      const key = handlerName.toLowerCase();
      const staffStat = staffStatsMap.get(key);
      if (!staffStat) return;
      const effectiveDate = new Date(inq.updatedAt || inq.createdAt);

      staffStat.totalPurchased += 1;

      if (effectiveDate >= startOfToday && effectiveDate <= endOfToday) {
        staffStat.todayPurchased += 1;
      }

      if (effectiveDate >= startOfMonth && effectiveDate < endOfMonth) {
        staffStat.monthPurchased += 1;
      }

      staffStat.inquiries.push({
        _id: inq._id,
        inquiryId: inq.inquiryId,
        studentName: inq.studentName,
        mobileNumber: inq.mobileNumber,
        subject: inq.subject,
        details: inq.details,
        status: inq.status,
        callType: inq.callType,
        remark: inq.remark || inq.actionTaken4 || inq.actionTaken3 || inq.actionTaken2 || inq.actionTaken1,
        date: effectiveDate,
        createdAt: inq.createdAt,
        updatedAt: inq.updatedAt,
      });
    });

    const staffStats = Array.from(staffStatsMap.values()).sort(
      (a, b) => b.totalPurchased - a.totalPurchased
    );

    const teamTotalPurchased = staffStats.reduce((sum, s) => sum + s.totalPurchased, 0);
    const teamTodayPurchased = staffStats.reduce((sum, s) => sum + s.todayPurchased, 0);
    const teamMonthPurchased = staffStats.reduce((sum, s) => sum + s.monthPurchased, 0);

    res.json({
      success: true,
      data: {
        summary: {
          teamTotalPurchased,
          teamTodayPurchased,
          teamMonthPurchased,
          topStaff: staffStats[0]?.name || 'N/A',
          totalStaffCount: staffStats.length,
          activeDate: startOfToday.toISOString().split('T')[0],
          activeMonth: `${tYear}-${String(tMonth + 1).padStart(2, '0')}`,
        },
        staffStats,
      },
    });
  } catch (error: any) {
    console.error('Error fetching purchased staff stats:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch purchased stats' });
  }
};

