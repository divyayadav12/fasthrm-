import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  fetchStudentInquiries,
  lookupStudentPhone,
  createStudentInquiry,
  updateStudentInquiry,
  deleteStudentInquiry,
  fetchStudentInquiryDetails,
  sendInquiryFeedback,
  clearLookupResult,
  clearSelectedInquiry,
  StudentInquiry,
} from '../store/slices/studentInquirySlice';
import { fetchEmployees } from '../store/slices/employeeSlice';
import axios from 'axios';
import {
  Headphones,
  PhoneCall,
  Phone,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  ShoppingBag,
  AlertCircle,
  Truck,
  Copy,
  Calendar,
  User as UserIcon,
  Trash2,
  Edit3,
  History,
  Sparkles,
  Link2,
  X,
  Check,
  RefreshCw,
  Eye,
  MessageCircle,
  ChevronDown,
  Info,
  Send,
  UserCheck,
  Smartphone,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm-1l03.onrender.com/api';

export const canAccessStudentInquiry = (user: any): boolean => {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const dept = (user.department || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();

  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isSupportOrIT =
    dept.includes('support') ||
    dept.includes('it') ||
    desig.includes('support') ||
    desig.includes('it');

  return isAdminOrManager || isSupportOrIT;
};

const CALL_TYPES = [
  'Enquiry',
  'Tech Issue',
  'Dispatch Related',
  'Purchased',
  'Device Changing',
  'Extension',
  'Others',
] as const;
const STATUS_TYPES = [
  'Solved',
  'Follow Up',
  'Purchased',
  'Pending',
  'Others',
] as const;

const DEFAULT_SUPPORT_STAFF = [
  { _id: 'def-1', name: 'Divya yadav', department: 'IT and support', designation: 'IT Support' },
  { _id: 'def-2', name: 'Jyoti', department: 'IT and support', designation: 'IT Support' },
  { _id: 'def-3', name: 'Pallavi', department: 'IT and support', designation: 'IT Support' },
  { _id: 'def-4', name: 'Palavi', department: 'IT and support', designation: 'IT Support' },
  { _id: 'def-5', name: 'Admin', department: 'Admin', designation: 'Admin' },
];

export default function StudentInquiries() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { employees } = useSelector((state: RootState) => state.employees);
  const {
    inquiries,
    stats,
    isLoading,
    total,
    totalPages,
    currentPage,
    lookupResult,
    isLookupLoading,
    selectedInquiry,
    relatedInquiries,
  } = useSelector((state: RootState) => state.studentInquiries);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAuthorized = canAccessStudentInquiry(user);

  const [supportStaffList, setSupportStaffList] = useState<any[]>(DEFAULT_SUPPORT_STAFF);

  useEffect(() => {
    dispatch(fetchEmployees({ limit: 200 }));

    const fetchSupportStaff = async () => {
      try {
        const token = user?.token || localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`${API_URL}/student-inquiries/support-staff`, config);
        if (res.data?.staff && Array.isArray(res.data.staff) && res.data.staff.length > 0) {
          setSupportStaffList(res.data.staff);
          return;
        }
      } catch (err) {
        console.error('Error fetching support staff list from /support-staff:', err);
      }

      try {
        const token = user?.token || localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const empRes = await axios.get(`${API_URL}/employees?limit=200`, config);
        if (empRes.data?.employees && Array.isArray(empRes.data.employees) && empRes.data.employees.length > 0) {
          setSupportStaffList(empRes.data.employees);
        }
      } catch (e2) {
        console.error('Fallback fetch /employees failed:', e2);
      }
    };

    fetchSupportStaff();
  }, [dispatch, user]);

  const itSupportEmployees = useMemo(() => {
    const rawList = supportStaffList.length > 0 ? supportStaffList : (employees || []);
    
    // Deduplicate by clean lowercase name
    const seenNames = new Set<string>();
    const uniqueList: any[] = [];
    rawList.forEach((emp) => {
      if (!emp || !emp.name || emp.name.trim().toLowerCase() === 'unknown') return;
      const clean = emp.name.trim().toLowerCase();
      if (!seenNames.has(clean)) {
        seenNames.add(clean);
        uniqueList.push(emp);
      }
    });

    const filtered = uniqueList.filter((emp) => {
      const dept = (emp.department || emp.designation || '').toLowerCase().trim();
      if (dept.includes('editor') || dept.includes('dtp')) return false;
      return (
        dept === 'it and support' ||
        dept === 'it & support' ||
        dept.includes('support') ||
        /\b(it)\b/i.test(dept) ||
        emp.role === 'ADMIN'
      );
    });

    if (filtered.length > 0) return filtered;
    return uniqueList;
  }, [supportStaffList, employees]);

  // Filter & Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [callTypeFilter, setCallTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [followUpDateFilter, setFollowUpDateFilter] = useState('');
  const [followUpPreset, setFollowUpPreset] = useState('ALL');
  const [attendedByFilter, setAttendedByFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 30;

  // Reset page to 1 whenever filters change
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };
  const handleCallTypeChange = (val: string) => {
    setCallTypeFilter(val);
    setPage(1);
  };
  const handleDateFilterChange = (val: string) => {
    setDateFilter(val);
    setPage(1);
  };
  const handleFollowUpDateChange = (val: string) => {
    setFollowUpDateFilter(val);
    setFollowUpPreset('ALL');
    setPage(1);
  };
  const handleFollowUpPresetChange = (val: string) => {
    setFollowUpPreset(val);
    if (val !== 'CUSTOM') {
      setFollowUpDateFilter('');
    }
    setPage(1);
  };
  const handleAttendedByChange = (val: string) => {
    setAttendedByFilter(val);
    setPage(1);
  };

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<StudentInquiry | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [sendingFeedbackId, setSendingFeedbackId] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [maxFollowUpSlotVisible, setMaxFollowUpSlotVisible] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState({
    studentName: '',
    mobileNumber: '',
    alternateNumber: '',
    email: '',
    callType: 'Enquiry' as (typeof CALL_TYPES)[number],
    subject: '',
    details: '',
    details2: '',
    details3: '',
    details4: '',
    remark: '',
    actionTaken1: '',
    actionTaken1Date: '',
    actionTaken1By: '',
    actionTaken1Status: '',
    actionTaken2: '',
    actionTaken2Date: '',
    actionTaken2By: '',
    actionTaken2Status: '',
    actionTaken3: '',
    actionTaken3Date: '',
    actionTaken3By: '',
    actionTaken3Status: '',
    actionTaken4: '',
    actionTaken4Date: '',
    actionTaken4By: '',
    actionTaken4Status: '',
    status: 'Pending' as (typeof STATUS_TYPES)[number],
    forwardedBy: user?.name || '',
    forwardedTo: '',
    previousInquiryId: '',
    followUpDate: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subject Suggestions State
  const [subjectSuggestions, setSubjectSuggestions] = useState<{ subject: string; count: number }[]>([]);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [isSubjectLoading, setIsSubjectLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const fetchSubjectSuggestions = async (query: string) => {
    try {
      setIsSubjectLoading(true);
      const token = user?.token || localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(
        `${API_URL}/student-inquiries/subject-suggestions?q=${encodeURIComponent(query)}`,
        config
      );
      if (res.data?.success && Array.isArray(res.data?.suggestions)) {
        setSubjectSuggestions(res.data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching subject suggestions:', err);
    } finally {
      setIsSubjectLoading(false);
    }
  };

  useEffect(() => {
    if (!isAddModalOpen) {
      setShowSubjectDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetchSubjectSuggestions(formData.subject || '');
    }, 250);
    return () => clearTimeout(timer);
  }, [formData.subject, isAddModalOpen]);

  // Load Inquiries on Mount & Filter Change
  const loadData = () => {
    const params: any = { page, limit, sortBy: 'updatedAt', sortOrder: 'desc' };
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (callTypeFilter !== 'ALL') params.callType = callTypeFilter;
    if (followUpPreset && followUpPreset !== 'ALL') params.followUpPreset = followUpPreset;
    if (followUpDateFilter) params.followUpDate = followUpDateFilter;
    if (attendedByFilter !== 'ALL') params.attendedBy = attendedByFilter;

    if (dateFilter === 'TODAY') {
      const today = new Date().toISOString().split('T')[0];
      params.dateFrom = today;
      params.dateTo = today;
    } else if (dateFilter === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      params.dateFrom = yStr;
      params.dateTo = yStr;
    } else if (dateFilter === 'THIS_WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      params.dateFrom = w.toISOString().split('T')[0];
    } else if (dateFilter === 'THIS_MONTH') {
      const m = new Date();
      m.setDate(1);
      params.dateFrom = m.toISOString().split('T')[0];
    }

    dispatch(fetchStudentInquiries(params));
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [dispatch, isAuthorized, statusFilter, callTypeFilter, dateFilter, followUpDateFilter, followUpPreset, attendedByFilter, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthorized) {
        setPage(1);
        loadData();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle Mobile Lookup when typing in Add Modal
  useEffect(() => {
    const cleanNumber = formData.mobileNumber.replace(/\D/g, '');
    if (cleanNumber.length >= 6) {
      dispatch(lookupStudentPhone(cleanNumber));
    } else {
      dispatch(clearLookupResult());
    }
  }, [formData.mobileNumber, dispatch]);

  // When mobile number lookup succeeds, auto-fill ONLY student name (keep fields blank and previousInquiryId empty for fresh inquiry)
  useEffect(() => {
    if (editingInquiry) return;
    if (lookupResult && lookupResult.found && lookupResult.latestInquiry) {
      if (!formData.studentName.trim() && lookupResult.studentName) {
        setFormData((prev) => ({ ...prev, studentName: lookupResult.studentName }));
      }
    }
  }, [lookupResult, editingInquiry]);

  const availableInquiriesForDropdown = useMemo(() => {
    const map = new Map<string, any>();
    if (lookupResult?.inquiries && lookupResult.inquiries.length > 0) {
      lookupResult.inquiries.forEach((item) => {
        if (item?.inquiryId) map.set(item.inquiryId.toUpperCase(), item);
      });
    }
    if (editingInquiry) {
      const editPhone = (editingInquiry.mobileNumber || '').replace(/\D/g, '').slice(-10);
      inquiries.forEach((item) => {
        const itemPhone = (item.mobileNumber || '').replace(/\D/g, '').slice(-10);
        if (editPhone && itemPhone && itemPhone === editPhone && item.inquiryId) {
          if (item.inquiryId.toUpperCase() !== editingInquiry.inquiryId?.toUpperCase()) {
            map.set(item.inquiryId.toUpperCase(), item);
          }
        }
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [lookupResult, editingInquiry, inquiries]);

  const selectedPrevInquiry = useMemo(() => {
    if (!formData.previousInquiryId || formData.previousInquiryId === 'CUSTOM') return null;
    const targetId = formData.previousInquiryId.trim().toUpperCase();
    if (availableInquiriesForDropdown && availableInquiriesForDropdown.length > 0) {
      const match = availableInquiriesForDropdown.find((i) => i.inquiryId?.toUpperCase() === targetId);
      if (match) return match;
    }
    return inquiries.find((i) => i.inquiryId?.toUpperCase() === targetId) || null;
  }, [formData.previousInquiryId, availableInquiriesForDropdown, inquiries]);

  // Auto-fill fields ONLY when an existing inquiry ID is explicitly selected from the dropdown
  useEffect(() => {
    if (editingInquiry) return;
    if (selectedPrevInquiry) {
      // Find all inquiries in lookupResult for this student in ascending order
      const ascInquiries = lookupResult?.inquiries && lookupResult.inquiries.length > 0
        ? [...lookupResult.inquiries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        : [selectedPrevInquiry];

      let r1 = '';
      let r1Date = '';
      let r1By = '';
      let r1Status = '';

      let r2 = '';
      let r2Date = '';
      let r2By = '';
      let r2Status = '';

      let r3 = '';
      let r3Date = '';
      let r3By = '';
      let r3Status = '';

      let r4 = '';
      let r4Date = '';
      let r4By = '';
      let r4Status = '';

      if (ascInquiries.length > 1) {
        // Multiple separate inquiries linked in student's thread
        // Slot 1 is ALWAYS the 1st inquiry in the thread
        r1 = ascInquiries[0]?.actionTaken1 || ascInquiries[0]?.remark || '';
        r1Date = ascInquiries[0]?.actionTaken1Date || (ascInquiries[0]?.createdAt ? new Date(ascInquiries[0].createdAt).toISOString() : '');
        r1By = ascInquiries[0]?.actionTaken1By || ascInquiries[0]?.addedByName || '';
        r1Status = ascInquiries[0]?.actionTaken1Status || ascInquiries[0]?.status || '';

        // Slot 2 is ALWAYS the 2nd inquiry in the thread
        r2 = ascInquiries[1]?.actionTaken2 || ascInquiries[1]?.actionTaken1 || ascInquiries[1]?.remark || '';
        r2Date = ascInquiries[1]?.actionTaken2Date || (ascInquiries[1]?.createdAt ? new Date(ascInquiries[1].createdAt).toISOString() : '');
        r2By = ascInquiries[1]?.actionTaken2By || ascInquiries[1]?.addedByName || '';
        r2Status = ascInquiries[1]?.actionTaken2Status || ascInquiries[1]?.status || '';

        // Slot 3 is the 3rd inquiry (if exists) or actionTaken3
        if (ascInquiries.length > 2) {
          r3 = ascInquiries[2]?.actionTaken3 || ascInquiries[2]?.actionTaken1 || ascInquiries[2]?.remark || '';
          r3Date = ascInquiries[2]?.actionTaken3Date || (ascInquiries[2]?.createdAt ? new Date(ascInquiries[2].createdAt).toISOString() : '');
          r3By = ascInquiries[2]?.actionTaken3By || ascInquiries[2]?.addedByName || '';
          r3Status = ascInquiries[2]?.actionTaken3Status || ascInquiries[2]?.status || '';
        } else {
          r3 = ascInquiries[0]?.actionTaken3 || ascInquiries[1]?.actionTaken3 || '';
          r3Date = ascInquiries[0]?.actionTaken3Date || ascInquiries[1]?.actionTaken3Date || '';
          r3By = ascInquiries[0]?.actionTaken3By || ascInquiries[1]?.actionTaken3By || '';
          r3Status = ascInquiries[0]?.actionTaken3Status || ascInquiries[1]?.actionTaken3Status || '';
        }

        // Slot 4 is the 4th inquiry (if exists) or actionTaken4
        if (ascInquiries.length > 3) {
          r4 = ascInquiries[3]?.actionTaken4 || ascInquiries[3]?.actionTaken1 || ascInquiries[3]?.remark || '';
          r4Date = ascInquiries[3]?.actionTaken4Date || (ascInquiries[3]?.createdAt ? new Date(ascInquiries[3].createdAt).toISOString() : '');
          r4By = ascInquiries[3]?.actionTaken4By || ascInquiries[3]?.addedByName || '';
          r4Status = ascInquiries[3]?.actionTaken4Status || ascInquiries[3]?.status || '';
        } else {
          r4 = ascInquiries[0]?.actionTaken4 || ascInquiries[1]?.actionTaken4 || '';
          r4Date = ascInquiries[0]?.actionTaken4Date || ascInquiries[1]?.actionTaken4Date || '';
          r4By = ascInquiries[0]?.actionTaken4By || ascInquiries[1]?.actionTaken4By || '';
          r4Status = ascInquiries[0]?.actionTaken4Status || ascInquiries[1]?.actionTaken4Status || '';
        }
      } else {
        const single = ascInquiries[0] || selectedPrevInquiry;

        r1 = single?.actionTaken1 || single?.remark || '';
        r1Date = single?.actionTaken1Date || (single?.createdAt ? new Date(single.createdAt).toISOString() : '');
        r1By = single?.actionTaken1By || single?.addedByName || '';
        r1Status = single?.actionTaken1Status || single?.status || '';

        r2 = single?.actionTaken2 || '';
        r2Date = single?.actionTaken2Date || '';
        r2By = single?.actionTaken2By || '';
        r2Status = single?.actionTaken2Status || '';

        r3 = single?.actionTaken3 || '';
        r3Date = single?.actionTaken3Date || '';
        r3By = single?.actionTaken3By || '';
        r3Status = single?.actionTaken3Status || '';

        r4 = single?.actionTaken4 || '';
        r4Date = single?.actionTaken4Date || '';
        r4By = single?.actionTaken4By || '';
        r4Status = single?.actionTaken4Status || '';
      }

      const activeSlotsCount = r4 ? 4 : (r3 ? 3 : (r2 ? 2 : 1));
      // Ready next slot for follow-up entry
      setMaxFollowUpSlotVisible(Math.min(4, activeSlotsCount + 1));

      setFormData((prev) => ({
        ...prev,
        studentName: selectedPrevInquiry.studentName || prev.studentName,
        callType: (CALL_TYPES as readonly string[]).includes(selectedPrevInquiry.callType)
          ? (selectedPrevInquiry.callType as (typeof CALL_TYPES)[number])
          : 'Enquiry',
        status: (STATUS_TYPES as readonly string[]).includes(selectedPrevInquiry.status)
          ? (selectedPrevInquiry.status as (typeof STATUS_TYPES)[number])
          : 'Pending',
        subject: selectedPrevInquiry.subject || '',
        details: selectedPrevInquiry.details || '',
        details2: selectedPrevInquiry.details2 || '',
        details3: selectedPrevInquiry.details3 || '',
        details4: selectedPrevInquiry.details4 || '',
        remark: selectedPrevInquiry.remark || '',
        actionTaken1: r1,
        actionTaken1Date: r1Date,
        actionTaken1By: r1By,
        actionTaken1Status: r1Status,
        actionTaken2: r2,
        actionTaken2Date: r2Date,
        actionTaken2By: r2By,
        actionTaken2Status: r2Status,
        actionTaken3: r3,
        actionTaken3Date: r3Date,
        actionTaken3By: r3By,
        actionTaken3Status: r3Status,
        actionTaken4: r4,
        actionTaken4Date: r4Date,
        actionTaken4By: r4By,
        actionTaken4Status: r4Status,
        forwardedBy: selectedPrevInquiry.forwardedBy || prev.forwardedBy,
        forwardedTo: selectedPrevInquiry.forwardedTo || '',
        alternateNumber: selectedPrevInquiry.alternateNumber || prev.alternateNumber,
        email: selectedPrevInquiry.email || prev.email,
        followUpDate: selectedPrevInquiry.followUpDate ? selectedPrevInquiry.followUpDate.split('T')[0] : '',
      }));
    } else {
      // If -- None (Fresh Inquiry) -- is selected (or previousInquiryId is empty), reset details/subject/remark/status for fresh entry
      setMaxFollowUpSlotVisible(1);
      setFormData((prev) => ({
        ...prev,
        subject: '',
        details: '',
        details2: '',
        details3: '',
        details4: '',
        remark: '',
        actionTaken1: '',
        actionTaken1Date: '',
        actionTaken1By: '',
        actionTaken1Status: '',
        actionTaken2: '',
        actionTaken2Date: '',
        actionTaken2By: '',
        actionTaken2Status: '',
        actionTaken3: '',
        actionTaken3Date: '',
        actionTaken3By: '',
        actionTaken3Status: '',
        actionTaken4: '',
        actionTaken4Date: '',
        actionTaken4By: '',
        actionTaken4Status: '',
        forwardedTo: '',
        callType: 'Enquiry',
        status: 'Pending',
        followUpDate: '',
      }));
    }
  }, [selectedPrevInquiry, lookupResult, editingInquiry]);

  // Compute all 4 prior call history cards for display under Reference section
  const priorCallsList = useMemo(() => {
    const inqMap = new Map<string, any>();
    if (availableInquiriesForDropdown && availableInquiriesForDropdown.length > 0) {
      availableInquiriesForDropdown.forEach((item) => {
        if (item?.inquiryId) inqMap.set(item.inquiryId.toUpperCase(), item);
      });
    }
    if (selectedPrevInquiry?.inquiryId) {
      inqMap.set(selectedPrevInquiry.inquiryId.toUpperCase(), selectedPrevInquiry);
    }

    const sortedInquiries = Array.from(inqMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (sortedInquiries.length === 0) return [];

    const list: Array<{
      key: string;
      callNumber: number;
      inquiryId: string;
      dateStr: string;
      subject?: string;
      details?: string;
      remark?: string;
      status: string;
      callType: string;
      attendedBy: string;
      isCurrentRef: boolean;
      isEmptySlot?: boolean;
    }> = [];

    // Case A: Multiple separate inquiries exist (e.g. INQ-1064, INQ-1131, etc.)
    if (sortedInquiries.length > 1) {
      sortedInquiries.forEach((inq, idx) => {
        const rem = inq.remark || inq.actionTaken4 || inq.actionTaken3 || inq.actionTaken2 || inq.actionTaken1 || '';
        list.push({
          key: `inq-${inq._id || inq.inquiryId || idx}`,
          callNumber: idx + 1,
          inquiryId: inq.inquiryId,
          dateStr: inq.createdAt
            ? new Date(inq.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '',
          subject: inq.subject || '',
          details: inq.details || '',
          remark: rem,
          status: inq.status || 'Follow Up',
          callType: inq.callType || 'Enquiry',
          attendedBy: inq.addedByName || inq.forwardedBy || 'Staff',
          isCurrentRef: inq.inquiryId?.toUpperCase() === formData.previousInquiryId?.trim().toUpperCase(),
        });
      });
      // Do NOT pad empty slots - only display real calls that have taken place
    } else {
      // Case B: Single inquiry record with slots 1 to 4
      const singleInq = sortedInquiries[0];

      // Call #1
      const r1 = singleInq.actionTaken1 || singleInq.remark || formData.actionTaken1 || '';
      if (r1.trim() || singleInq.details?.trim()) {
        list.push({
          key: `act-1-${singleInq.inquiryId}`,
          callNumber: 1,
          inquiryId: singleInq.inquiryId,
          dateStr: singleInq.actionTaken1Date || singleInq.createdAt
            ? new Date(singleInq.actionTaken1Date || singleInq.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '',
          subject: singleInq.subject || '',
          details: singleInq.details || 'Initial discussion',
          remark: r1,
          status: singleInq.actionTaken1Status || singleInq.status || 'Follow Up',
          callType: singleInq.callType || 'Enquiry',
          attendedBy: singleInq.actionTaken1By || singleInq.addedByName || 'Staff',
          isCurrentRef: true,
        });
      }

      // Call #2 - ONLY show if it actually has content
      const call2Remark = singleInq.actionTaken2 || formData.actionTaken2 || '';
      if (call2Remark.trim() || singleInq.details2?.trim()) {
        list.push({
          key: `act-2-${singleInq.inquiryId}`,
          callNumber: 2,
          inquiryId: singleInq.inquiryId,
          dateStr: singleInq.actionTaken2Date || singleInq.updatedAt
            ? new Date(singleInq.actionTaken2Date || singleInq.updatedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          subject: singleInq.subject || '',
          details: singleInq.details2 || singleInq.details || '2nd Follow-up discussion',
          remark: call2Remark,
          status: singleInq.actionTaken2Status || singleInq.status || 'Follow Up',
          callType: 'Follow Up',
          attendedBy: singleInq.actionTaken2By || (formData.actionTaken2 ? (user?.name || 'Staff') : 'Staff'),
          isCurrentRef: false,
        });
      }

      // Call #3 - ONLY show if it actually has content
      const call3Remark = singleInq.actionTaken3 || formData.actionTaken3 || '';
      if (call3Remark.trim() || singleInq.details3?.trim()) {
        list.push({
          key: `act-3-${singleInq.inquiryId}`,
          callNumber: 3,
          inquiryId: singleInq.inquiryId,
          dateStr: singleInq.actionTaken3Date
            ? new Date(singleInq.actionTaken3Date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : (call3Remark ? new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
          subject: singleInq.subject || '',
          details: singleInq.details3 || singleInq.details || '3rd Follow-up discussion',
          remark: call3Remark,
          status: singleInq.actionTaken3Status || (call3Remark ? formData.status : 'Follow Up'),
          callType: 'Follow Up',
          attendedBy: singleInq.actionTaken3By || (call3Remark ? (user?.name || 'Staff') : 'Staff'),
          isCurrentRef: false,
        });
      }

      // Call #4 - ONLY show if it actually has content
      const call4Remark = singleInq.actionTaken4 || formData.actionTaken4 || '';
      if (call4Remark.trim() || singleInq.details4?.trim()) {
        list.push({
          key: `act-4-${singleInq.inquiryId}`,
          callNumber: 4,
          inquiryId: singleInq.inquiryId,
          dateStr: singleInq.actionTaken4Date
            ? new Date(singleInq.actionTaken4Date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : (call4Remark ? new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''),
          subject: singleInq.subject || '',
          details: singleInq.details4 || singleInq.details || '4th Follow-up discussion',
          remark: call4Remark,
          status: singleInq.actionTaken4Status || (call4Remark ? formData.status : 'Follow Up'),
          callType: 'Follow Up',
          attendedBy: singleInq.actionTaken4By || (call4Remark ? (user?.name || 'Staff') : 'Staff'),
          isCurrentRef: false,
        });
      }
    }

    return list.slice(0, 4);
  }, [lookupResult, selectedPrevInquiry, formData.previousInquiryId, formData.actionTaken1, formData.actionTaken2, formData.actionTaken3, formData.actionTaken4, formData.status, user?.name]);

  const resetForm = () => {
    setFormData({
      studentName: '',
      mobileNumber: '',
      alternateNumber: '',
      email: '',
      callType: 'Enquiry',
      subject: '',
      details: '',
      details2: '',
      details3: '',
      details4: '',
      remark: '',
      actionTaken1: '',
      actionTaken1Date: '',
      actionTaken1By: '',
      actionTaken1Status: '',
      actionTaken2: '',
      actionTaken2Date: '',
      actionTaken2By: '',
      actionTaken2Status: '',
      actionTaken3: '',
      actionTaken3Date: '',
      actionTaken3By: '',
      actionTaken3Status: '',
      actionTaken4: '',
      actionTaken4Date: '',
      actionTaken4By: '',
      actionTaken4Status: '',
      status: 'Pending',
      forwardedBy: user?.name || '',
      forwardedTo: '',
      previousInquiryId: '',
      followUpDate: '',
    });
    setFormErrors({});
    setEditingInquiry(null);
    setMaxFollowUpSlotVisible(1);
    dispatch(clearLookupResult());
    setShowSubjectDropdown(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    resetForm();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.studentName.trim()) errors.studentName = 'Student name is required';
    if (!formData.mobileNumber.trim()) {
      errors.mobileNumber = 'Mobile number is required';
    } else if (formData.mobileNumber.replace(/\D/g, '').length < 10) {
      errors.mobileNumber = 'Please enter a valid 10-digit mobile number';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitNewInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Determine latest remark from the 4 action taken slots
      const finalRemark = formData.actionTaken4?.trim() || formData.actionTaken3?.trim() || formData.actionTaken2?.trim() || formData.actionTaken1?.trim() || formData.remark?.trim() || '';

      const submissionData = {
        ...formData,
        remark: finalRemark,
        actionTaken1By: formData.actionTaken1By || (formData.actionTaken1 ? user?.name : ''),
        actionTaken1Status: formData.actionTaken1Status || (formData.actionTaken1 ? formData.status : ''),
        actionTaken2By: formData.actionTaken2By || (formData.actionTaken2 ? user?.name : ''),
        actionTaken2Status: formData.actionTaken2Status || (formData.actionTaken2 ? formData.status : ''),
        actionTaken3By: formData.actionTaken3By || (formData.actionTaken3 ? user?.name : ''),
        actionTaken3Status: formData.actionTaken3Status || (formData.actionTaken3 ? formData.status : ''),
        actionTaken4By: formData.actionTaken4By || (formData.actionTaken4 ? user?.name : ''),
        actionTaken4Status: formData.actionTaken4Status || (formData.actionTaken4 ? formData.status : ''),
      };

      // Check if user has linked an existing inquiry
      const targetLinkedDoc =
        selectedPrevInquiry ||
        (formData.previousInquiryId && formData.previousInquiryId !== 'CUSTOM'
          ? (availableInquiriesForDropdown.find(
              (i) => i.inquiryId?.toUpperCase() === formData.previousInquiryId.trim().toUpperCase()
            ) || inquiries.find((i) => i.inquiryId?.toUpperCase() === formData.previousInquiryId.trim().toUpperCase()))
          : null);

      if (editingInquiry && editingInquiry._id) {
        // User clicked edit on existing record: update it
        const resultAction = await dispatch(
          updateStudentInquiry({ id: editingInquiry._id, data: submissionData })
        );
        if (updateStudentInquiry.fulfilled.match(resultAction)) {
          setNotificationMsg({
            type: 'success',
            text: `Student Record ${editingInquiry.inquiryId} updated successfully!`,
          });
          handleCloseAddModal();
          loadData();
        } else {
          setNotificationMsg({
            type: 'error',
            text: (resultAction.payload as string) || 'Failed to update student record',
          });
        }
      } else if (targetLinkedDoc && targetLinkedDoc._id) {
        // LINKED INQUIRY: UPDATE THE EXISTING INQUIRY (NO DUPLICATE ROW CREATED)
        const updatedSubData = { ...submissionData };
        // If targetLinkedDoc already had actionTaken1 and new remark was typed in actionTaken1:
        if (targetLinkedDoc.actionTaken1 && !updatedSubData.actionTaken2 && !targetLinkedDoc.actionTaken2) {
          if (updatedSubData.actionTaken1 !== targetLinkedDoc.actionTaken1) {
            updatedSubData.actionTaken2 = updatedSubData.actionTaken1 || updatedSubData.remark;
            updatedSubData.actionTaken1 = targetLinkedDoc.actionTaken1;
            updatedSubData.actionTaken1Date = targetLinkedDoc.actionTaken1Date || targetLinkedDoc.createdAt;
            updatedSubData.actionTaken1By = targetLinkedDoc.actionTaken1By || targetLinkedDoc.addedByName;
            updatedSubData.actionTaken1Status = targetLinkedDoc.actionTaken1Status || targetLinkedDoc.status;
          }
        }

        const resultAction = await dispatch(
          updateStudentInquiry({ id: targetLinkedDoc._id, data: updatedSubData })
        );
        if (updateStudentInquiry.fulfilled.match(resultAction)) {
          setNotificationMsg({
            type: 'success',
            text: `Inquiry ${targetLinkedDoc.inquiryId} updated with linked follow-up successfully!`,
          });
          handleCloseAddModal();
          loadData();
        } else {
          setNotificationMsg({
            type: 'error',
            text: (resultAction.payload as string) || 'Failed to update linked inquiry',
          });
        }
      } else {
        // "+ Add Student Inquiry": Fresh inquiry
        const resultAction = await dispatch(createStudentInquiry(submissionData));
        if (createStudentInquiry.fulfilled.match(resultAction)) {
          setNotificationMsg({
            type: 'success',
            text: `New Student Inquiry ${resultAction.payload.inquiry.inquiryId} logged successfully!`,
          });
          handleCloseAddModal();
          loadData();
        } else {
          setNotificationMsg({
            type: 'error',
            text: (resultAction.payload as string) || 'Failed to create inquiry',
          });
        }
      }
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Error saving inquiry' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleOpenEdit = (inquiry: StudentInquiry) => {
    setEditingInquiry(inquiry);
    const hist = inquiry.history || [];
    const act1 = inquiry.actionTaken1 || hist[0]?.remark || inquiry.remark || '';
    const act1Date = inquiry.actionTaken1Date || (hist[0]?.date ? new Date(hist[0].date).toISOString() : '') || (inquiry.createdAt ? new Date(inquiry.createdAt).toISOString() : '');
    const act1By = inquiry.actionTaken1By || hist[0]?.attendedBy || (typeof inquiry.addedBy === 'object' ? inquiry.addedBy.name : inquiry.addedByName) || '';
    const act1Status = inquiry.actionTaken1Status || hist[0]?.status || inquiry.status || '';

    const act2 = inquiry.actionTaken2 || hist[1]?.remark || '';
    const act2Date = inquiry.actionTaken2Date || (hist[1]?.date ? new Date(hist[1].date).toISOString() : '') || '';
    const act2By = inquiry.actionTaken2By || hist[1]?.attendedBy || '';
    const act2Status = inquiry.actionTaken2Status || hist[1]?.status || '';

    const act3 = inquiry.actionTaken3 || hist[2]?.remark || '';
    const act3Date = inquiry.actionTaken3Date || (hist[2]?.date ? new Date(hist[2].date).toISOString() : '') || '';
    const act3By = inquiry.actionTaken3By || hist[2]?.attendedBy || '';
    const act3Status = inquiry.actionTaken3Status || hist[2]?.status || '';

    const act4 = inquiry.actionTaken4 || hist[3]?.remark || '';
    const act4Date = inquiry.actionTaken4Date || (hist[3]?.date ? new Date(hist[3].date).toISOString() : '') || '';
    const act4By = inquiry.actionTaken4By || hist[3]?.attendedBy || '';
    const act4Status = inquiry.actionTaken4Status || hist[3]?.status || '';

    const highest = act4 ? 4 : (act3 ? 3 : (act2 ? 2 : 1));
    setMaxFollowUpSlotVisible(highest);

    setFormData({
      studentName: inquiry.studentName || '',
      mobileNumber: inquiry.mobileNumber || '',
      alternateNumber: inquiry.alternateNumber || '',
      email: inquiry.email || '',
      callType: (CALL_TYPES as readonly string[]).includes(inquiry.callType)
        ? (inquiry.callType as (typeof CALL_TYPES)[number])
        : 'Enquiry',
      subject: inquiry.subject || '',
      details: inquiry.details || '',
      details2: inquiry.details2 || hist[1]?.details || '',
      details3: inquiry.details3 || hist[2]?.details || '',
      details4: inquiry.details4 || hist[3]?.details || '',
      remark: inquiry.remark || act1 || '',
      actionTaken1: act1,
      actionTaken1Date: act1Date,
      actionTaken1By: act1By,
      actionTaken1Status: act1Status,
      actionTaken2: act2,
      actionTaken2Date: act2Date,
      actionTaken2By: act2By,
      actionTaken2Status: act2Status,
      actionTaken3: act3,
      actionTaken3Date: act3Date,
      actionTaken3By: act3By,
      actionTaken3Status: act3Status,
      actionTaken4: act4,
      actionTaken4Date: act4Date,
      actionTaken4By: act4By,
      actionTaken4Status: act4Status,
      status: (STATUS_TYPES as readonly string[]).includes(inquiry.status)
        ? (inquiry.status as (typeof STATUS_TYPES)[number])
        : 'Others',
      forwardedBy: inquiry.forwardedBy || user?.name || '',
      forwardedTo: inquiry.forwardedTo || '',
      previousInquiryId: inquiry.previousInquiryId || '',
      followUpDate: inquiry.followUpDate ? inquiry.followUpDate.split('T')[0] : '',
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleUpdateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInquiry) return;

    setIsSubmitting(true);
    try {
      const resultAction = await dispatch(
        updateStudentInquiry({ id: editingInquiry._id, data: formData })
      );
      if (updateStudentInquiry.fulfilled.match(resultAction)) {
        setNotificationMsg({
          type: 'success',
          text: `Inquiry ${editingInquiry.inquiryId} updated successfully!`,
        });
        setIsEditModalOpen(false);
        setEditingInquiry(null);
        loadData();
      } else {
        setNotificationMsg({
          type: 'error',
          text: (resultAction.payload as string) || 'Failed to update inquiry',
        });
      }
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Error updating inquiry' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleDelete = async (id: string, inqId: string) => {
    if (window.confirm(`Are you sure you want to delete inquiry ${inqId}?`)) {
      const resultAction = await dispatch(deleteStudentInquiry(id));
      if (deleteStudentInquiry.fulfilled.match(resultAction)) {
        setNotificationMsg({ type: 'success', text: `Inquiry ${inqId} deleted.` });
      } else {
        setNotificationMsg({ type: 'error', text: 'Failed to delete inquiry.' });
      }
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleViewDetails = (inquiryId: string) => {
    dispatch(fetchStudentInquiryDetails(inquiryId));
    setIsDetailModalOpen(true);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleSendFeedback = async (id: string, inqId: string) => {
    if (sendingFeedbackId) return;
    setSendingFeedbackId(id);
    try {
      const resultAction = await dispatch(sendInquiryFeedback(id));
      if (sendInquiryFeedback.fulfilled.match(resultAction)) {
        setNotificationMsg({
          type: 'success',
          text: `Feedback message sent successfully for ${inqId}!`,
        });
      } else {
        setNotificationMsg({
          type: 'error',
          text: (resultAction.payload as string) || 'Failed to send feedback message.',
        });
      }
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Error sending feedback.' });
    } finally {
      setSendingFeedbackId(null);
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleOpenWhatsApp = (mobileNumber: string, mode: 'app' | 'web' = 'app') => {
    const cleanNumber = (mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (!cleanNumber) return;

    if (mode === 'app') {
      // Opens WhatsApp App on PC directly (No browser tab created!)
      window.location.href = `whatsapp://send?phone=91${cleanNumber}`;
    } else {
      // Opens WhatsApp Web in browser
      const whatsappUrl = `https://web.whatsapp.com/send/?phone=91${cleanNumber}`;
      window.open(whatsappUrl, 'WhatsAppWeb');
    }
  };

  // Status Badge Colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Solved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Follow Up':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Purchased':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Pending':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'FAST Education App':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FAST Education 2.0 App':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Call Type Badge Colors
  const getCallTypeBadge = (callType: string) => {
    switch (callType) {
      case 'Tech Issue':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Dispatch Related':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Purchased':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Device Changing':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Extension':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Enquiry':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Access Denied Screen
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 shadow-xs">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 max-w-md">
          The <strong>Student Inquiry</strong> portal is reserved exclusively for Admin, IT, and Support staff.
          Please contact your administrator if you require access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notificationMsg && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm font-medium transition-all ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-red-600 text-white shadow-red-600/30'
          }`}
        >
          {notificationMsg.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Student Inquiries</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                IT & Support
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Track student calls, resolve tech issues, and manage connected student histories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-xl transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md shadow-indigo-600/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student Inquiry</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-col gap-3">
        {/* Top Row: Search, Quick Filters & Dropdowns */}
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Left Side: Search Bar & Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto flex-1">
            {/* Search Bar */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, number, INQ ID..."
                className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dedicated "Enquiry" Filter Button */}
            <button
              onClick={() => setCallTypeFilter(callTypeFilter === 'Enquiry' ? 'ALL' : 'Enquiry')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Enquiry'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/25 ring-2 ring-indigo-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-indigo-50/60 hover:text-indigo-600 hover:border-indigo-200'
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-600" />
              <span>Enquiry</span>
              {callTypeFilter === 'Enquiry' && (
                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                  Active
                </span>
              )}
            </button>

            {/* Quick "Tech Issue" Filter Button */}
            <button
              onClick={() => setCallTypeFilter(callTypeFilter === 'Tech Issue' ? 'ALL' : 'Tech Issue')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Tech Issue'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-orange-600/25 ring-2 ring-orange-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-orange-50/60 hover:text-orange-600 hover:border-orange-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Tech Issue</span>
            </button>

            {/* Quick "Dispatch" Filter Button */}
            <button
              onClick={() => setCallTypeFilter(callTypeFilter === 'Dispatch Related' ? 'ALL' : 'Dispatch Related')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Dispatch Related'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-purple-600/25 ring-2 ring-purple-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-purple-50/60 hover:text-purple-600 hover:border-purple-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-purple-500" />
              <span>Dispatch</span>
            </button>

            {/* Quick "Device Changing" Filter Button */}
            <button
              onClick={() => setCallTypeFilter(callTypeFilter === 'Device Changing' ? 'ALL' : 'Device Changing')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Device Changing'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-teal-600/25 ring-2 ring-teal-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-teal-50/60 hover:text-teal-600 hover:border-teal-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-500" />
              <span>Device Changing</span>
            </button>

            {/* Quick "Extension" Filter Button */}
            <button
              onClick={() => setCallTypeFilter(callTypeFilter === 'Extension' ? 'ALL' : 'Extension')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Extension'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-violet-600/25 ring-2 ring-violet-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-violet-50/60 hover:text-violet-600 hover:border-violet-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>Extension</span>
            </button>

            {/* Quick "Follow Up" Filter Button */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Follow Up' ? 'ALL' : 'Follow Up')}
              className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                statusFilter === 'Follow Up'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-amber-600/25 ring-2 ring-amber-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-amber-50/60 hover:text-amber-600 hover:border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Follow Up</span>
              {statusFilter === 'Follow Up' && (
                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                  Active
                </span>
              )}
            </button>
          </div>

          {/* Right Side: Status & Date Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Status</option>
              {STATUS_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="THIS_WEEK">Last 7 Days</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>
        </div>

        {/* Second Row: Follow-Up Date & Attended By Filters under Search Box */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-gray-100">
          {/* Follow-Up Date Filter Container with Presets and Exact Date Picker */}
          <div className={`relative flex items-center flex-wrap gap-2 border rounded-xl px-3 h-auto sm:h-10 py-1 sm:py-0 shadow-2xs transition-colors ${
            statusFilter === 'Follow Up' || followUpPreset !== 'ALL' || followUpDateFilter
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-gray-50 hover:bg-gray-100/80 border-gray-200'
          }`}>
            <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Follow-Up Date:
            </span>

            {/* Quick Follow-Up Preset Selector */}
            <select
              value={followUpPreset}
              onChange={(e) => handleFollowUpPresetChange(e.target.value)}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer py-1"
            >
              <option value="ALL">All Follow-Up Dates</option>
              <option value="TODAY">📅 Today's Follow-Ups</option>
              <option value="TOMORROW">⏭️ Tomorrow's Follow-Ups</option>
              <option value="OVERDUE">⚠️ Overdue / Pending</option>
              <option value="UPCOMING_7">🗓️ Next 7 Days</option>
              <option value="CUSTOM">📅 Specific Date Picker</option>
            </select>

            {/* Specific Date Picker (shown if user wants specific date or has date selected) */}
            <input
              type="date"
              value={followUpDateFilter}
              onChange={(e) => handleFollowUpDateChange(e.target.value)}
              title="Filter by Specific Follow-Up Date"
              className="text-xs font-semibold text-gray-800 bg-white/80 border border-amber-200 rounded-md px-1.5 py-0.5 focus:outline-hidden cursor-pointer"
            />

            {(followUpDateFilter || followUpPreset !== 'ALL') && (
              <button
                onClick={() => {
                  setFollowUpDateFilter('');
                  setFollowUpPreset('ALL');
                }}
                className="p-0.5 text-gray-400 hover:text-red-500 rounded-full"
                title="Clear Follow-Up Date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Attended By Dropdown Filter */}
          <div className="relative flex items-center gap-2 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl px-3 h-10 shadow-2xs transition-colors">
            <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5 shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              Attended By:
            </span>
            <select
              value={attendedByFilter}
              onChange={(e) => handleAttendedByChange(e.target.value)}
              title="Filter by Staff Member who attended"
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer py-1 pr-1 max-w-[160px] truncate"
            >
              <option value="ALL">All Staff</option>
              {itSupportEmployees.map((emp: any) => (
                <option key={emp._id || emp.name} value={emp.name}>
                  {emp.name}
                </option>
              ))}
            </select>
            {attendedByFilter !== 'ALL' && (
              <button
                onClick={() => handleAttendedByChange('ALL')}
                className="p-0.5 text-gray-400 hover:text-red-500 rounded-full shrink-0"
                title="Clear Attended By filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset Filter Button if active */}
          {(callTypeFilter !== 'ALL' || statusFilter !== 'ALL' || followUpDateFilter !== '' || followUpPreset !== 'ALL' || attendedByFilter !== 'ALL') && (
            <button
              onClick={() => {
                setCallTypeFilter('ALL');
                setStatusFilter('ALL');
                setFollowUpDateFilter('');
                setFollowUpPreset('ALL');
                setAttendedByFilter('ALL');
              }}
              className="h-10 inline-flex items-center px-3 text-xs text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100 whitespace-nowrap cursor-pointer"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Inquiries Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-sm">Loading inquiries...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <PhoneCall className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-700">No Inquiries Found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || callTypeFilter !== 'ALL'
                ? 'Try clearing some search filters to find inquiries.'
                : 'Click "+ Add Student Inquiry" above to log the first call.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3.5">Inquiry ID</th>
                  <th className="px-5 py-3.5">Student Details</th>
                  <th className="px-5 py-3.5">Call Type</th>
                  <th className="px-5 py-3.5">Subject & Details</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Follow-Up Date</th>
                  <th className="px-5 py-3.5">Attended By</th>
                  <th className="px-5 py-3.5">Reference ID</th>
                  <th className="px-5 py-3.5">Date & Time (Updated)</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((inq) => (
                  <tr key={inq._id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Inquiry ID */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {inq.inquiryId}
                      </span>
                    </td>

                    {/* Student Info */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{inq.studentName}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="font-mono">{inq.mobileNumber}</span>
                        <button
                          onClick={() => handleCopyPhone(inq.mobileNumber)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Copy phone"
                        >
                          {copiedPhone === inq.mobileNumber ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`whatsapp://send?phone=91${inq.mobileNumber.replace(/\D/g, '').slice(-10)}`}
                          className="text-emerald-600 hover:text-emerald-700 ml-1 p-0.5 hover:bg-emerald-50 rounded transition-colors inline-flex items-center"
                          title="Open in WhatsApp App"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        {inq.feedbackSent ? (
                          <button
                            type="button"
                            disabled
                            className="text-emerald-700 bg-emerald-100/90 border border-emerald-300 ml-1 p-0.5 rounded transition-all cursor-not-allowed opacity-90 inline-flex items-center"
                            title="Feedback Sent Successfully"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendFeedback(inq._id, inq.inquiryId)}
                            disabled={sendingFeedbackId === inq._id}
                            className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 ml-1 p-0.5 rounded transition-all cursor-pointer active:scale-95 shadow-2xs inline-flex items-center"
                            title="Send Feedback"
                          >
                            {sendingFeedbackId === inq._id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Call Type */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getCallTypeBadge(
                          inq.callType
                        )}`}
                      >
                        {inq.callType}
                      </span>
                    </td>

                    {/* Subject & Details */}
                    <td className="px-5 py-4 max-w-xs">
                      {inq.subject && (
                        <div className="font-medium text-xs text-gray-800 line-clamp-1">{inq.subject}</div>
                      )}
                      {inq.details ? (
                        <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{inq.details}</div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">No description</div>
                      )}
                      {inq.remark && (
                        <div className="text-[11px] text-amber-700 bg-amber-50/60 px-2 py-0.5 rounded-md mt-1 inline-block border border-amber-100">
                          Remark: {inq.remark}
                        </div>
                      )}
                      {inq.forwardedTo && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 max-w-fit">
                          <Send className="w-3 h-3 text-indigo-500" />
                          <span>Forwarded by: {inq.forwardedBy || inq.addedByName}</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getStatusBadge(
                          inq.status
                        )}`}
                      >
                        {inq.status}
                      </span>
                    </td>

                    {/* Follow-Up Date */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {inq.followUpDate ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 max-w-fit">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {new Date(inq.followUpDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">-</span>
                      )}
                    </td>

                    {/* Attended By (Staff Name) */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {(() => {
                        const attendedName = inq.forwardedTo || inq.addedByName;
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                              {attendedName?.charAt(0)?.toUpperCase() || 'S'}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-900">{attendedName}</div>
                              <div className="text-[10px] text-gray-400">
                                {inq.addedByDepartment || 'Support'}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Previous / Reference ID */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {inq.previousInquiryId ? (
                        <button
                          onClick={() => handleViewDetails(inq._id)}
                          className="inline-flex items-center gap-1 text-xs font-mono font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-200 transition-colors"
                          title="View Connected Call History"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{inq.previousInquiryId}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Fresh Call</span>
                      )}
                    </td>

                    {/* Date & Time (Shows the latest updated/changed date, e.g. 3rd instead of 2nd) */}
                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                      <div className="font-semibold text-gray-900">
                        {new Date(inq.updatedAt || inq.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] text-indigo-600 font-medium">
                        {new Date(inq.updatedAt || inq.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                      {inq.createdAt && inq.updatedAt && new Date(inq.createdAt).toDateString() !== new Date(inq.updatedAt).toDateString() && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          First: {new Date(inq.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(inq._id)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View History Thread"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(inq)}
                          className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit / Update"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(inq._id, inq.inquiryId)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-gray-500 font-medium">
              Showing <span className="font-semibold text-gray-800">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-gray-800">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold text-gray-800">{total}</span> inquiries (30 per page)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs"
              >
                Previous
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-gray-400 font-medium">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(Number(item))}
                        disabled={isLoading}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                          page === item
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 🚀 ADD STUDENT INQUIRY MODAL WITH LIVE NUMBER LOOKUP      */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 rounded-t-3xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingInquiry ? `Edit Student Inquiry (${editingInquiry.inquiryId})` : 'Add Student Inquiry'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Logged in as: <strong className="text-indigo-600">{user?.name}</strong> ({user?.department || user?.designation || 'Staff'})
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseAddModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitNewInquiry} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Mobile Number with Live Lookup */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="Enter 10-digit student mobile number"
                    className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      formErrors.mobileNumber ? 'border-red-400 bg-red-50/20' : 'border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                  {isLookupLoading && (
                    <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-spin" />
                  )}
                </div>
                {formErrors.mobileNumber && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.mobileNumber}</p>
                )}
              </div>

              {/* Connected / Previous Reference ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Previous / Connected Inquiry ID (Optional)
                    </label>
                    {editingInquiry && (
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                        Current: {editingInquiry.inquiryId}
                      </span>
                    )}
                  </div>
                  {availableInquiriesForDropdown && availableInquiriesForDropdown.length > 0 && (
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {availableInquiriesForDropdown.length} Previous Inquiries Found
                    </span>
                  )}
                </div>

                {availableInquiriesForDropdown && availableInquiriesForDropdown.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                      <select
                        value={formData.previousInquiryId}
                        onChange={(e) => setFormData({ ...formData, previousInquiryId: e.target.value })}
                        className="w-full pl-10 pr-10 py-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs sm:text-sm font-medium text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer shadow-2xs"
                      >
                        <option value="">-- None (Fresh Inquiry / No Connection) --</option>
                        {availableInquiriesForDropdown.map((prevInq) => (
                          <option key={prevInq._id} value={prevInq.inquiryId}>
                            [{prevInq.inquiryId}] • {prevInq.status} • {prevInq.callType} : {prevInq.subject ? prevInq.subject + ' - ' : ''}{(prevInq.details || '').substring(0, 35)}... (By {prevInq.addedByName} on {new Date(prevInq.createdAt).toLocaleDateString('en-IN')})
                          </option>
                        ))}
                        <option value="CUSTOM">+ Enter Custom Inquiry ID Manually...</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Manual input if CUSTOM selected */}
                    {(formData.previousInquiryId === 'CUSTOM' ||
                      (formData.previousInquiryId &&
                        !availableInquiriesForDropdown.some(
                          (i) => i.inquiryId?.toUpperCase() === formData.previousInquiryId?.toUpperCase()
                        ))) && (
                      <div className="relative animate-in fade-in duration-150">
                        <input
                          type="text"
                          value={formData.previousInquiryId === 'CUSTOM' ? '' : formData.previousInquiryId}
                          onChange={(e) =>
                            setFormData({ ...formData, previousInquiryId: e.target.value.toUpperCase() })
                          }
                          placeholder="Type Custom Inquiry ID (e.g. INQ-1001)"
                          className="w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    )}

                    {/* All Prior Calls History Cards (Up to 4 Calls Displayed) */}
                    {priorCallsList.length > 0 && (
                      <div className="space-y-2 mt-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            Connected History (Call 1 se 4 tak)
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            Student ke previous calls ki details
                          </span>
                        </div>

                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {priorCallsList.map((callItem) => (
                            <div
                              key={callItem.key}
                              className={`p-3 rounded-2xl text-xs space-y-2 border transition-all ${
                                callItem.isCurrentRef
                                  ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/30 shadow-xs'
                                  : 'bg-white border-gray-200 hover:border-indigo-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border shadow-2xs ${
                                      callItem.isCurrentRef
                                        ? 'text-indigo-700 bg-white border-indigo-200'
                                        : 'text-gray-700 bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    🔗 Call #{callItem.callNumber}: {callItem.inquiryId}
                                  </span>
                                  {callItem.isCurrentRef && (
                                    <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                                      Connected Ref
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  {callItem.dateStr}
                                </span>
                              </div>

                              <div className="text-gray-800 bg-white/90 p-2.5 rounded-xl border border-gray-100 shadow-2xs space-y-1">
                                {callItem.subject && (
                                  <div className="font-semibold text-gray-900">
                                    {callItem.subject}
                                  </div>
                                )}
                                {callItem.details && (
                                  <div className="text-gray-600 text-[11px] leading-relaxed">
                                    <strong className="text-gray-700">Problem / Issue:</strong> {callItem.details}
                                  </div>
                                )}
                                {callItem.remark && (
                                  <div className="text-[11px] text-amber-900 bg-amber-50/90 px-2.5 py-1 rounded-lg border border-amber-200/70 mt-1">
                                    <strong>Previous Remark:</strong> {callItem.remark}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge(
                                    callItem.status
                                  )}`}
                                >
                                  {callItem.status}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCallTypeBadge(
                                    callItem.callType
                                  )}`}
                                >
                                  {callItem.callType}
                                </span>
                                <span className="text-gray-500 text-[11px] ml-auto">
                                  Attended By: <strong>{callItem.attendedBy}</strong>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.previousInquiryId}
                      onChange={(e) => setFormData({ ...formData, previousInquiryId: e.target.value })}
                      placeholder="e.g. INQ-1001 (Leave empty for fresh callers)"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                    />
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  Agar pehle kisi aur ne call attend kiya ho, to dropdown se purani ID select karein taaki history link ho jaye.
                </p>
              </div>

              {/* Live Number Lookup Alert Banner */}
              {!editingInquiry && lookupResult && lookupResult.found && lookupResult.latestInquiry && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Existing Student Record Found ({lookupResult.count} Prior Calls)</span>
                    </div>
                    <span className="text-[11px] bg-amber-200/80 px-2.5 py-0.5 rounded-full font-semibold">
                      Latest: {lookupResult.latestInquiry.inquiryId}
                    </span>
                  </div>

                  {/* Auto-link Reference ID option */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="linkRefCheck"
                      checked={!!formData.previousInquiryId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previousInquiryId: e.target.checked
                            ? lookupResult.latestInquiry?.inquiryId || ''
                            : '',
                        })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="linkRefCheck" className="text-xs font-semibold cursor-pointer text-amber-900">
                      Link as Follow-up to Previous Inquiry ({lookupResult.latestInquiry.inquiryId})
                    </label>
                  </div>
                </div>
              )}

              {/* Student Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    placeholder="Enter student full name"
                    className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      formErrors.studentName ? 'border-red-400 bg-red-50/20' : 'border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {formErrors.studentName && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.studentName}</p>
                )}
              </div>

              {/* Call Type & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Call Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Call Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.callType}
                    onChange={(e) =>
                      setFormData({ ...formData, callType: e.target.value as (typeof CALL_TYPES)[number] })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {CALL_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as (typeof STATUS_TYPES)[number] })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {STATUS_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject / Topic with Smart Suggestions */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Subject / Topic
                  </label>
                  {subjectSuggestions.length > 0 && showSubjectDropdown && (
                    <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      Staff suggestions available
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => {
                      setFormData({ ...formData, subject: e.target.value });
                      setShowSubjectDropdown(true);
                      setSelectedSuggestionIndex(-1);
                    }}
                    onFocus={() => {
                      setShowSubjectDropdown(true);
                      fetchSubjectSuggestions(formData.subject || '');
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSubjectDropdown(false), 250);
                    }}
                    onKeyDown={(e) => {
                      if (!showSubjectDropdown || subjectSuggestions.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev < subjectSuggestions.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev > 0 ? prev - 1 : subjectSuggestions.length - 1
                        );
                      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                        e.preventDefault();
                        const picked = subjectSuggestions[selectedSuggestionIndex];
                        if (picked) {
                          setFormData({ ...formData, subject: picked.subject });
                          setShowSubjectDropdown(false);
                        }
                      } else if (e.key === 'Escape') {
                        setShowSubjectDropdown(false);
                      }
                    }}
                    placeholder="e.g. Video player issue / Book tracking / Course details"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {isSubjectLoading && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown Popup */}
                {showSubjectDropdown && subjectSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-indigo-100 shadow-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="px-3 py-1.5 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between text-[11px] font-semibold text-indigo-900 sticky top-0 z-10 backdrop-blur-xs">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Staff Topics ({subjectSuggestions.length})
                      </span>
                      <span className="text-[10px] text-gray-500 font-normal">Click or Enter to select</span>
                    </div>
                    {subjectSuggestions.map((item, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, subject: item.subject });
                          setShowSubjectDropdown(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          selectedSuggestionIndex === idx
                            ? 'bg-indigo-50 text-indigo-900 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                        }`}
                      >
                        <span className="truncate flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="truncate">{item.subject}</span>
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-full ml-2 shrink-0">
                          {item.count} {item.count === 1 ? 'call' : 'calls'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Inquiry Details / Issue Description
                </label>
                <textarea
                  rows={3}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Provide complete notes of what student asked or issue faced..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Staff Remark / Action Taken (4 Follow-Up Details / Cells) */}
              <div className="space-y-3.5 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Staff Remark / Follow-Up Action Taken
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Student ke sabhi 4 follow-ups ki details alag-alag cells me note karein (Action 1 se Action 4 tak)
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/90 px-2.5 py-0.5 rounded-full border border-indigo-200 shrink-0">
                    {Math.max(1, maxFollowUpSlotVisible)} Active Slot{maxFollowUpSlotVisible > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Dynamic Action Taken / Follow-Up Cells (Only show active & filled slots) */}
                <div className="space-y-3 pt-1">
                  {/* CELL 1: Action Taken 1 (Always visible) */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    formData.actionTaken1
                      ? 'bg-white border-indigo-200 shadow-2xs'
                      : 'bg-white/70 border-gray-200 hover:border-indigo-200'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-gray-700 uppercase mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-indigo-700 font-bold">Action Taken 1 (Call / Follow-Up #1)</span>
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${getStatusBadge(formData.actionTaken1Status || formData.status)}`}>
                          {formData.actionTaken1Status || formData.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-normal">
                        {formData.actionTaken1By
                          ? `By ${formData.actionTaken1By} ${formData.actionTaken1Date ? `on ${new Date(formData.actionTaken1Date).toLocaleDateString('en-IN')}` : ''}`
                          : formData.actionTaken1
                          ? `By ${user?.name || 'Staff'}`
                          : 'Initial Call'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={formData.actionTaken1}
                      onChange={(e) => setFormData({ ...formData, actionTaken1: e.target.value })}
                      placeholder="Call #1 staff remark / action taken..."
                      className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-gray-200 focus:border-indigo-400 rounded-lg text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  {/* CELL 2: Action Taken 2 (Shown only if filled or user opened slot 2) */}
                  {(Boolean(formData.actionTaken2?.trim()) || maxFollowUpSlotVisible >= 2) && (
                    <div className={`p-3 rounded-xl border transition-all animate-in fade-in duration-150 ${
                      formData.actionTaken2
                        ? 'bg-white border-amber-300 shadow-2xs'
                        : 'bg-white/70 border-gray-200 hover:border-amber-300'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-gray-700 uppercase mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-700 font-bold">Action Taken 2 (Call / Follow-Up #2)</span>
                          <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${getStatusBadge(formData.actionTaken2Status || 'Follow Up')}`}>
                            {formData.actionTaken2Status || 'Follow Up'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {formData.actionTaken2By
                            ? `By ${formData.actionTaken2By} ${formData.actionTaken2Date ? `on ${new Date(formData.actionTaken2Date).toLocaleDateString('en-IN')}` : ''}`
                            : formData.actionTaken2
                            ? `By ${user?.name || 'Staff'}`
                            : '2nd Follow-Up'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.actionTaken2}
                        onChange={(e) => setFormData({ ...formData, actionTaken2: e.target.value })}
                        placeholder="Call #2 staff action taken / discussion notes..."
                        className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-gray-200 focus:border-amber-400 rounded-lg text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 transition-all"
                      />
                    </div>
                  )}

                  {/* CELL 3: Action Taken 3 (Shown only if filled or user opened slot 3) */}
                  {(Boolean(formData.actionTaken3?.trim()) || maxFollowUpSlotVisible >= 3) && (
                    <div className={`p-3 rounded-xl border transition-all animate-in fade-in duration-150 ${
                      formData.actionTaken3
                        ? 'bg-white border-purple-300 shadow-2xs'
                        : 'bg-white/70 border-gray-200 hover:border-purple-300'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-gray-700 uppercase mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-700 font-bold">Action Taken 3 (Call / Follow-Up #3)</span>
                          <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${getStatusBadge(formData.actionTaken3Status || 'Follow Up')}`}>
                            {formData.actionTaken3Status || 'Follow Up'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {formData.actionTaken3By
                            ? `By ${formData.actionTaken3By} ${formData.actionTaken3Date ? `on ${new Date(formData.actionTaken3Date).toLocaleDateString('en-IN')}` : ''}`
                            : formData.actionTaken3
                            ? `By ${user?.name || 'Staff'}`
                            : '3rd Follow-Up'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.actionTaken3}
                        onChange={(e) => setFormData({ ...formData, actionTaken3: e.target.value })}
                        placeholder="Call #3 staff action taken / student reply notes..."
                        className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-gray-200 focus:border-purple-400 rounded-lg text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>
                  )}

                  {/* CELL 4: Action Taken 4 (Shown only if filled or user opened slot 4) */}
                  {(Boolean(formData.actionTaken4?.trim()) || maxFollowUpSlotVisible >= 4) && (
                    <div className={`p-3 rounded-xl border transition-all animate-in fade-in duration-150 ${
                      formData.actionTaken4
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : 'bg-white/70 border-gray-200 hover:border-emerald-300'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-gray-700 uppercase mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700 font-bold">Action Taken 4 (Call / Follow-Up #4)</span>
                          <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${getStatusBadge(formData.actionTaken4Status || formData.status)}`}>
                            {formData.actionTaken4Status || formData.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {formData.actionTaken4By
                            ? `By ${formData.actionTaken4By} ${formData.actionTaken4Date ? `on ${new Date(formData.actionTaken4Date).toLocaleDateString('en-IN')}` : ''}`
                            : formData.actionTaken4
                            ? `By ${user?.name || 'Staff'}`
                            : '4th Follow-Up'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.actionTaken4}
                        onChange={(e) => setFormData({ ...formData, actionTaken4: e.target.value })}
                        placeholder="Call #4 staff action taken / final confirmation or resolution..."
                        className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-gray-200 focus:border-emerald-400 rounded-lg text-xs font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  )}

                  {/* Button to reveal next follow-up slot if fewer than 4 are visible */}
                  {maxFollowUpSlotVisible < 4 && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setMaxFollowUpSlotVisible((prev) => Math.min(4, Math.max(prev + 1, 2)))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 shadow-2xs transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Follow-Up #{Math.min(4, maxFollowUpSlotVisible + 1)}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Handled By & Handled To Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Handled By */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Handled By
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                    <input
                      type="text"
                      readOnly
                      value={formData.forwardedBy || user?.name || ''}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100/90 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 cursor-not-allowed select-none"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Auto-filled with logged-in employee name</p>
                </div>

                {/* Handled To (IT and Support Employees Dropdown) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Handled To (IT & Support)
                  </label>
                  <div className="relative">
                    <Headphones className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                    <select
                      value={formData.forwardedTo}
                      onChange={(e) => setFormData({ ...formData, forwardedTo: e.target.value })}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="">-- Select Handled To Staff (Optional) --</option>
                      {itSupportEmployees.map((emp) => (
                        <option key={emp._id} value={emp.name}>
                          {emp.name} ({emp.designation || emp.department || 'IT & Support'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Assign to IT Support employee</p>
                </div>
              </div>

              {/* Follow-Up Date (Optional Field, highlighted when Status is 'Follow Up') */}
              <div
                className={`p-4 rounded-2xl transition-all border ${
                  formData.status === 'Follow Up'
                    ? 'bg-amber-50/80 border-amber-200/90 shadow-2xs'
                    : 'bg-gray-50/70 border-gray-200/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className={`block text-xs font-bold uppercase tracking-wider ${
                      formData.status === 'Follow Up' ? 'text-amber-900' : 'text-gray-700'
                    }`}
                  >
                    Follow-Up Date <span className="font-normal text-gray-500">(Optional)</span>
                  </label>
                  {formData.status === 'Follow Up' && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Follow Up Active
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Calendar
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      formData.status === 'Follow Up' ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  />
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      formData.status === 'Follow Up'
                        ? 'bg-white border border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                        : 'bg-white border border-gray-200 text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                    }`}
                  />
                </div>
                <p
                  className={`text-[11px] mt-1 ${
                    formData.status === 'Follow Up' ? 'text-amber-800 font-medium' : 'text-gray-400'
                  }`}
                >
                  Agar follow-up schedule karna ho to date select karein (Optional).
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>
                      {editingInquiry
                        ? `Update Student Record (${editingInquiry.inquiryId})`
                        : formData.previousInquiryId
                        ? `Save Follow-Up Entry (Linked to ${formData.previousInquiryId})`
                        : 'Save New Inquiry'}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ========================================================= */}
      {/* 📜 DETAIL & CALL HISTORY TIMELINE MODAL                   */}
      {/* ========================================================= */}
      {isDetailModalOpen && selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 rounded-t-3xl">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-sm font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg">
                  {selectedInquiry.inquiryId}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedInquiry.studentName}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono">{selectedInquiry.mobileNumber}</span>
                    <a
                      href={`whatsapp://send?phone=91${selectedInquiry.mobileNumber.replace(/\D/g, '').slice(-10)}`}
                      className="text-emerald-600 hover:text-emerald-700 p-0.5 hover:bg-emerald-50 rounded transition-colors inline-flex items-center"
                      title="Open in WhatsApp App"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                    {selectedInquiry.feedbackSent ? (
                      <button
                        type="button"
                        disabled
                        className="text-emerald-700 bg-emerald-100/90 border border-emerald-300 p-0.5 rounded transition-all cursor-not-allowed opacity-90 inline-flex items-center"
                        title="Feedback Sent Successfully"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendFeedback(selectedInquiry._id, selectedInquiry.inquiryId)}
                        disabled={sendingFeedbackId === selectedInquiry._id}
                        className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 p-0.5 rounded transition-all cursor-pointer active:scale-95 shadow-2xs inline-flex items-center"
                        title="Send Feedback"
                      >
                        {sendingFeedbackId === selectedInquiry._id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold border ${getStatusBadge(selectedInquiry.status)}`}>
                      {selectedInquiry.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  dispatch(clearSelectedInquiry());
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Primary Call Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getCallTypeBadge(selectedInquiry.callType)}`}>
                    {selectedInquiry.callType}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(selectedInquiry.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>

                {selectedInquiry.subject && (
                  <h4 className="font-semibold text-sm text-gray-900">{selectedInquiry.subject}</h4>
                )}
                <p className="text-sm text-gray-700 leading-relaxed">{selectedInquiry.details || 'No description provided'}</p>

                {selectedInquiry.remark && (
                  <div className="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs text-gray-700">
                    <strong className="text-indigo-700">Latest Staff Remark:</strong> {selectedInquiry.remark}
                  </div>
                )}

                {/* All 4 Follow-Up Action Takens Breakdown */}
                {(selectedInquiry.actionTaken1 || selectedInquiry.actionTaken2 || selectedInquiry.actionTaken3 || selectedInquiry.actionTaken4) && (
                  <div className="space-y-2 pt-2 border-t border-indigo-100">
                    <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Follow-Up Actions History (Up to 4 Follow-Ups):
                    </div>
                    {[
                      { num: 1, text: selectedInquiry.actionTaken1, date: selectedInquiry.actionTaken1Date || selectedInquiry.createdAt, by: selectedInquiry.actionTaken1By || selectedInquiry.addedByName, status: selectedInquiry.actionTaken1Status || selectedInquiry.status },
                      { num: 2, text: selectedInquiry.actionTaken2, date: selectedInquiry.actionTaken2Date, by: selectedInquiry.actionTaken2By, status: selectedInquiry.actionTaken2Status },
                      { num: 3, text: selectedInquiry.actionTaken3, date: selectedInquiry.actionTaken3Date, by: selectedInquiry.actionTaken3By, status: selectedInquiry.actionTaken3Status },
                      { num: 4, text: selectedInquiry.actionTaken4, date: selectedInquiry.actionTaken4Date, by: selectedInquiry.actionTaken4By, status: selectedInquiry.actionTaken4Status },
                    ].map((act) => act.text ? (
                      <div key={act.num} className="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs text-gray-700 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900">
                          <span className="font-bold">Action Taken {act.num}</span>
                          <span className="text-gray-400 font-normal">
                            {act.by ? `By ${act.by}` : ''} {act.date ? `on ${new Date(act.date).toLocaleDateString('en-IN')}` : ''}
                          </span>
                        </div>
                        <p className="text-gray-800">{act.text}</p>
                      </div>
                    ) : null)}
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-100/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>Attended By: <strong>{selectedInquiry.forwardedTo || selectedInquiry.addedByName}</strong> ({selectedInquiry.addedByDepartment || 'Support'})</span>
                  {selectedInquiry.forwardedTo && (
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 font-medium">
                      👉 Forwarded By: <strong>{selectedInquiry.forwardedBy || selectedInquiry.addedByName}</strong>
                    </span>
                  )}
                  {selectedInquiry.previousInquiryId && (
                    <span className="font-mono text-indigo-700">Ref: {selectedInquiry.previousInquiryId}</span>
                  )}
                </div>
              </div>

              {/* Related Calls Timeline */}
              {relatedInquiries && relatedInquiries.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>Complete Call History for this Student ({relatedInquiries.length} Previous Calls)</span>
                  </div>

                  <div className="space-y-3 border-l-2 border-indigo-100 ml-3 pl-4">
                    {relatedInquiries.map((rel) => (
                      <div key={rel._id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5 relative">
                        <div className="absolute -left-[23px] top-4 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-700">{rel.inquiryId}</span>
                          <span className="text-gray-400">{new Date(rel.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="text-gray-800 font-medium">{rel.details}</div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                          <span>By: <strong>{rel.addedByName}</strong></span>
                          <span className={`px-2 py-0.5 rounded-md ${getStatusBadge(rel.status)}`}>{rel.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  dispatch(clearSelectedInquiry());
                }}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
