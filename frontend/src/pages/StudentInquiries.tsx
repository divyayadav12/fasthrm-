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
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

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

const CALL_TYPES = ['Enquiry', 'Tech Issue', 'Dispatch Related', 'Purchases', 'Others'] as const;
const STATUS_TYPES = [
  'Solved',
  'Follow Up',
  'Purchases',
  'Pending',
  'FAST Education App',
  'FAST Education 2.0 App',
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

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [callTypeFilter, setCallTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [followUpDateFilter, setFollowUpDateFilter] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<StudentInquiry | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    studentName: '',
    mobileNumber: '',
    alternateNumber: '',
    email: '',
    callType: 'Enquiry' as (typeof CALL_TYPES)[number],
    subject: '',
    details: '',
    remark: '',
    status: 'Pending' as (typeof STATUS_TYPES)[number],
    forwardedBy: user?.name || '',
    forwardedTo: '',
    previousInquiryId: '',
    followUpDate: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Inquiries on Mount & Filter Change
  const loadData = () => {
    const params: any = {};
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (callTypeFilter !== 'ALL') params.callType = callTypeFilter;
    if (followUpDateFilter) params.followUpDate = followUpDateFilter;

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
  }, [dispatch, isAuthorized, statusFilter, callTypeFilter, dateFilter, followUpDateFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthorized) loadData();
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
    if (lookupResult && lookupResult.found && lookupResult.latestInquiry) {
      if (!formData.studentName.trim() && lookupResult.studentName) {
        setFormData((prev) => ({ ...prev, studentName: lookupResult.studentName }));
      }
    }
  }, [lookupResult]);

  const selectedPrevInquiry = useMemo(() => {
    if (!formData.previousInquiryId || formData.previousInquiryId === 'CUSTOM') return null;
    const targetId = formData.previousInquiryId.trim().toUpperCase();
    if (lookupResult?.inquiries && lookupResult.inquiries.length > 0) {
      const match = lookupResult.inquiries.find((i) => i.inquiryId?.toUpperCase() === targetId);
      if (match) return match;
    }
    return inquiries.find((i) => i.inquiryId?.toUpperCase() === targetId) || null;
  }, [formData.previousInquiryId, lookupResult, inquiries]);

  // Auto-fill fields ONLY when an existing inquiry ID is explicitly selected from the dropdown
  useEffect(() => {
    if (selectedPrevInquiry) {
      setFormData((prev) => ({
        ...prev,
        studentName: selectedPrevInquiry.studentName || prev.studentName,
        callType: selectedPrevInquiry.callType || 'Enquiry',
        status: selectedPrevInquiry.status || 'Pending',
        subject: selectedPrevInquiry.subject || '',
        details: selectedPrevInquiry.details || '',
        remark: selectedPrevInquiry.remark || '',
        forwardedBy: selectedPrevInquiry.forwardedBy || prev.forwardedBy,
        forwardedTo: selectedPrevInquiry.forwardedTo || '',
        alternateNumber: selectedPrevInquiry.alternateNumber || prev.alternateNumber,
        email: selectedPrevInquiry.email || prev.email,
      }));
    } else {
      // If -- None (Fresh Inquiry) -- is selected (or previousInquiryId is empty), reset details/subject/remark/status for fresh entry
      setFormData((prev) => ({
        ...prev,
        subject: '',
        details: '',
        remark: '',
        forwardedTo: '',
        callType: 'Enquiry',
        status: 'Pending',
      }));
    }
  }, [selectedPrevInquiry]);

  // Compute prior inquiries ONLY if a previous inquiry ID is explicitly selected in the dropdown
  const linkedPriorInquiries = useMemo(() => {
    if (!formData.previousInquiryId || formData.previousInquiryId === 'CUSTOM') {
      return [];
    }
    if (!lookupResult?.inquiries || lookupResult.inquiries.length === 0) {
      return [];
    }
    const allAsc = [...lookupResult.inquiries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const targetId = formData.previousInquiryId.trim().toUpperCase();
    const matchIndex = allAsc.findIndex((i) => i.inquiryId?.toUpperCase() === targetId);

    if (matchIndex !== -1) {
      return allAsc.slice(0, matchIndex + 1).slice(-3);
    }
    return allAsc.slice(-3);
  }, [formData.previousInquiryId, lookupResult]);

  const resetForm = () => {
    setFormData({
      studentName: '',
      mobileNumber: '',
      alternateNumber: '',
      email: '',
      callType: 'Enquiry',
      subject: '',
      details: '',
      remark: '',
      status: 'Pending',
      forwardedBy: user?.name || '',
      forwardedTo: '',
      previousInquiryId: '',
      followUpDate: '',
    });
    setFormErrors({});
    dispatch(clearLookupResult());
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
      // Always UPDATE if student mobile number exists in DB or if an inquiry ID is selected, preventing duplicate rows
      const targetInquiryToUpdate = selectedPrevInquiry || (lookupResult?.found ? lookupResult.latestInquiry : null);

      if (targetInquiryToUpdate && targetInquiryToUpdate._id) {
        const resultAction = await dispatch(
          updateStudentInquiry({ id: targetInquiryToUpdate._id, data: formData })
        );
        if (updateStudentInquiry.fulfilled.match(resultAction)) {
          setNotificationMsg({
            type: 'success',
            text: `Student Record ${targetInquiryToUpdate.inquiryId} updated successfully!`,
          });
          handleCloseAddModal();
          loadData();
        } else {
          setNotificationMsg({
            type: 'error',
            text: (resultAction.payload as string) || 'Failed to update student record',
          });
        }
      } else {
        // Create new inquiry ONLY IF student mobile number is completely new to the database
        const resultAction = await dispatch(createStudentInquiry(formData));
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
    setFormData({
      studentName: inquiry.studentName || '',
      mobileNumber: inquiry.mobileNumber || '',
      alternateNumber: inquiry.alternateNumber || '',
      email: inquiry.email || '',
      callType: inquiry.callType || 'Enquiry',
      subject: inquiry.subject || '',
      details: inquiry.details || '',
      remark: inquiry.remark || '',
      status: inquiry.status || 'Pending',
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
      case 'Purchases':
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
      case 'Purchases':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
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
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Left Side: Search Bar & Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
            {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, number, INQ ID..."
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
              className={`h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
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
              className={`h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
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
              className={`h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
                callTypeFilter === 'Dispatch Related'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-purple-600/25 ring-2 ring-purple-500/20'
                  : 'bg-white text-gray-700 border-gray-200/90 hover:bg-purple-50/60 hover:text-purple-600 hover:border-purple-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-purple-500" />
              <span>Dispatch</span>
            </button>

            {/* Quick "Follow Up" Filter Button */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'Follow Up' ? 'ALL' : 'Follow Up')}
              className={`h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs whitespace-nowrap cursor-pointer active:scale-95 ${
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

        {/* Second Row: Follow-Up Date Filter Picker under Search Box */}
        <div className="flex items-center gap-2.5 pt-1 border-t border-gray-100">
          <div className="relative flex items-center gap-2 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl px-3 h-10 shadow-2xs transition-colors">
            <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Follow-Up Date:
            </span>
            <input
              type="date"
              value={followUpDateFilter}
              onChange={(e) => setFollowUpDateFilter(e.target.value)}
              title="Filter by Follow-Up Date"
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
            />
            {followUpDateFilter && (
              <button
                onClick={() => setFollowUpDateFilter('')}
                className="p-0.5 text-gray-400 hover:text-red-500 rounded-full"
                title="Clear Follow-Up Date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset Filter Button if active */}
          {(callTypeFilter !== 'ALL' || statusFilter !== 'ALL' || followUpDateFilter !== '') && (
            <button
              onClick={() => {
                setCallTypeFilter('ALL');
                setStatusFilter('ALL');
                setFollowUpDateFilter('');
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
                  <th className="px-5 py-3.5">Attended By</th>
                  <th className="px-5 py-3.5">Reference ID</th>
                  <th className="px-5 py-3.5">Date & Time</th>
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
                          <span>Forwarded to: {inq.forwardedTo}</span>
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

                    {/* Added By (Staff Name) */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                          {inq.addedByName?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{inq.addedByName}</div>
                          <div className="text-[10px] text-gray-400">
                            {inq.addedByDepartment || 'Support'}
                          </div>
                        </div>
                      </div>
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

                    {/* Date */}
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500">
                      <div>{new Date(inq.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(inq.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
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
                  <h3 className="text-lg font-bold text-gray-900">Add Student Inquiry</h3>
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

              {/* Connected / Previous Reference ID Dropdown (MOVED UP HERE) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Previous / Connected Inquiry ID (Optional)
                  </label>
                  {lookupResult?.inquiries && lookupResult.inquiries.length > 0 && (
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {lookupResult.inquiries.length} Previous Inquiries Found
                    </span>
                  )}
                </div>

                {/* If previous inquiries found for this student number, show dropdown */}
                {lookupResult?.inquiries && lookupResult.inquiries.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                      <select
                        value={formData.previousInquiryId}
                        onChange={(e) => setFormData({ ...formData, previousInquiryId: e.target.value })}
                        className="w-full pl-10 pr-10 py-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs sm:text-sm font-medium text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer shadow-2xs"
                      >
                        <option value="">-- None (Fresh Inquiry / No Connection) --</option>
                        {lookupResult.inquiries.map((prevInq) => (
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
                        !lookupResult.inquiries.some(
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

                    {/* Selected Previous Inquiry Full Details Card */}
                    {selectedPrevInquiry && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                            🔗 Selected Reference: {selectedPrevInquiry.inquiryId}
                          </span>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {new Date(selectedPrevInquiry.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="text-gray-800 bg-white/80 p-2 rounded-xl border border-indigo-100/80">
                          {selectedPrevInquiry.subject && (
                            <div className="font-semibold text-gray-900 mb-0.5">
                              {selectedPrevInquiry.subject}
                            </div>
                          )}
                          <div className="text-gray-600">{selectedPrevInquiry.details}</div>
                          {selectedPrevInquiry.remark && (
                            <div className="text-[11px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md mt-1 border border-amber-200/60">
                              <strong>Previous Remark:</strong> {selectedPrevInquiry.remark}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge(
                              selectedPrevInquiry.status
                            )}`}
                          >
                            {selectedPrevInquiry.status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCallTypeBadge(
                              selectedPrevInquiry.callType
                            )}`}
                          >
                            {selectedPrevInquiry.callType}
                          </span>
                          <span className="text-gray-500 text-[11px] ml-auto">
                            Attended By: <strong>{selectedPrevInquiry.addedByName}</strong>
                          </span>
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
              {lookupResult && lookupResult.found && lookupResult.latestInquiry && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Existing Student Record Found ({lookupResult.count} Prior Calls)</span>
                    </div>
                    <span className="text-[11px] bg-amber-200/80 px-2 py-0.5 rounded-full font-semibold">
                      Latest: {lookupResult.latestInquiry.inquiryId}
                    </span>
                  </div>

                  <div className="text-xs bg-white/80 p-3 rounded-xl border border-amber-100 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">
                        Attended By: {lookupResult.latestInquiry.addedByName}
                      </span>
                      <span className="text-gray-500">
                        {new Date(lookupResult.latestInquiry.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      <strong>Issue / Topic:</strong> {lookupResult.latestInquiry.details}
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      <span className="font-semibold">Status:</span>
                      <span className={`px-2 py-0.5 rounded-md ${getStatusBadge(lookupResult.latestInquiry.status)}`}>
                        {lookupResult.latestInquiry.status}
                      </span>
                    </div>
                  </div>

                  {/* Auto-link Reference ID option */}
                  <div className="flex items-center gap-2 pt-1">
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

              {/* Subject / Topic */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Subject / Topic
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Video player issue / Book tracking / Course details"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
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

              {/* Dynamic Staff Remark / Action Taken (Shows prior action fields ONLY when a previous inquiry is selected in dropdown) */}
              <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Staff Remark / Action Taken
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/90 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {linkedPriorInquiries.length === 0
                      ? 'Fresh Call (No Linked History)'
                      : `Linked Call Thread (${linkedPriorInquiries.length + 1}th Call in Thread)`}
                  </span>
                </div>

                {/* Previous Call Auto-filled Fields (Shown ONLY if linkedPriorInquiries has items) */}
                {linkedPriorInquiries.length > 0 &&
                  linkedPriorInquiries.map((prevInq, idx) => {
                    const fieldNum = idx + 1;
                    return (
                      <div key={prevInq._id || idx} className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-gray-600 uppercase">
                          <div className="flex items-center gap-1.5">
                            <span>Action Taken {fieldNum} (Call #{fieldNum} - {prevInq.inquiryId})</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(prevInq.status)}`}>
                              {prevInq.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-normal">
                            By {prevInq.addedByName || 'Staff'} on {new Date(prevInq.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={prevInq.remark || prevInq.details || 'No previous remark recorded'}
                          className="w-full px-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-medium text-gray-700 cursor-not-allowed select-none"
                        />
                      </div>
                    );
                  })}

                {/* Active / Current Call Action Taken Input */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-indigo-700 uppercase">
                      Action Taken {linkedPriorInquiries.length > 0 ? linkedPriorInquiries.length + 1 : 1} (Current Call)
                    </label>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(formData.status)}`}>
                      Status: {formData.status}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    placeholder="e.g. Cleared app cache, student confirmed working."
                    className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
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
                      {selectedPrevInquiry || lookupResult?.found
                        ? `Update Student Record (${selectedPrevInquiry?.inquiryId || lookupResult?.latestInquiry?.inquiryId})`
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
                    <strong className="text-indigo-700">Staff Remark:</strong> {selectedInquiry.remark}
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-100/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>Attended By: <strong>{selectedInquiry.addedByName}</strong> ({selectedInquiry.addedByDepartment || 'Support'})</span>
                  {selectedInquiry.forwardedTo && (
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 font-medium">
                      👉 Forwarded To: <strong>{selectedInquiry.forwardedTo}</strong> {selectedInquiry.forwardedBy ? `(By ${selectedInquiry.forwardedBy})` : ''}
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
