import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm-1l03.onrender.com/api';
import {
  ShoppingBag,
  Calendar,
  Search,
  RefreshCw,
  Trophy,
  UserCheck,
  TrendingUp,
  Clock,
  Phone,
  MessageCircle,
  X,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { canAccessStudentInquiry } from './StudentInquiries';

interface PurchasedStudentItem {
  _id: string;
  inquiryId: string;
  studentName: string;
  mobileNumber: string;
  subject?: string;
  details?: string;
  status: string;
  callType: string;
  remark?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

interface StaffPurchasedStat {
  _id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  profileImage?: string;
  totalPurchased: number;
  todayPurchased: number;
  monthPurchased: number;
  inquiries: PurchasedStudentItem[];
}

interface SummaryStats {
  teamTotalPurchased: number;
  teamTodayPurchased: number;
  teamMonthPurchased: number;
  topStaff: string;
  totalStaffCount: number;
  activeDate: string;
  activeMonth: string;
}

export default function PurchasedInquiries() {
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffStats, setStaffStats] = useState<StaffPurchasedStat[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    teamTotalPurchased: 0,
    teamTodayPurchased: 0,
    teamMonthPurchased: 0,
    topStaff: 'N/A',
    totalStaffCount: 0,
    activeDate: new Date().toISOString().split('T')[0],
    activeMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  });

  // Filter states
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<StaffPurchasedStat | null>(null);
  const [modalFilter, setModalFilter] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');

  const isAuthorized = canAccessStudentInquiry(user);

  // Fetch Purchased Stats from backend
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedMonth) params.append('month', selectedMonth);

      const token = localStorage.getItem('token') || (user && (user as any).token);
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const res = await axios.get(
        `${API_URL}/student-inquiries/purchased-stats?${params.toString()}`,
        config
      );
      if (res.data?.success && res.data?.data) {
        setStaffStats(res.data.data.staffStats || []);
        setSummary(res.data.data.summary);
      }
    } catch (err: any) {
      console.error('Failed to load purchased stats:', err);
      setError(err?.response?.data?.message || 'Failed to fetch purchased statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
    }
  }, [selectedDate, selectedMonth, isAuthorized]);

  // Filtered staff list by search
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffStats;
    const q = searchQuery.toLowerCase().trim();
    return staffStats.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q)
    );
  }, [staffStats, searchQuery]);

  // Modal student list filtered by period
  const modalStudents = useMemo(() => {
    if (!selectedStaffForModal) return [];
    if (modalFilter === 'ALL') return selectedStaffForModal.inquiries;

    return selectedStaffForModal.inquiries.filter((inq) => {
      const inqDate = new Date(inq.date || inq.updatedAt || inq.createdAt);
      if (modalFilter === 'TODAY') {
        const inqDateStr = inqDate.toISOString().split('T')[0];
        return inqDateStr === selectedDate;
      }
      if (modalFilter === 'MONTH') {
        const inqMonthStr = `${inqDate.getFullYear()}-${String(inqDate.getMonth() + 1).padStart(2, '0')}`;
        return inqMonthStr === selectedMonth;
      }
      return true;
    });
  }, [selectedStaffForModal, modalFilter, selectedDate, selectedMonth]);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-600 max-w-md">
          The <strong>Purchased Tracker</strong> page is reserved exclusively for IT & Support staff and Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">IT & Support Purchased Tracker</h1>
              <p className="text-xs text-gray-500">
                Staff member-wise student purchases & conversions (Day & Month wise)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Day Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-gray-500">Day:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-hidden cursor-pointer"
            />
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-gray-500">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-hidden cursor-pointer"
            />
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-2xs cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Purchased */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-white p-5 rounded-2xl border border-emerald-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">All-Time Purchased</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-900 tracking-tight">
              {summary.teamTotalPurchased}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">Total student admissions / purchases</p>
          </div>
        </div>

        {/* Today's Purchased */}
        <div className="bg-gradient-to-br from-blue-500/10 via-white to-white p-5 rounded-2xl border border-blue-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Purchased" : 'Selected Day'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-blue-900 tracking-tight">
              {summary.teamTodayPurchased}
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* This Month's Purchased */}
        <div className="bg-gradient-to-br from-purple-500/10 via-white to-white p-5 rounded-2xl border border-purple-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Selected Month
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-purple-900 tracking-tight">
              {summary.teamMonthPurchased}
            </div>
            <p className="text-[11px] text-purple-700 mt-1">
              Month of {new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Top Performer Staff */}
        <div className="bg-gradient-to-br from-amber-500/10 via-white to-white p-5 rounded-2xl border border-amber-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Top Performer</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-amber-950 truncate" title={summary.topStaff}>
              {summary.topStaff}
            </div>
            <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-amber-500" /> Leading conversions in IT & Support
            </p>
          </div>
        </div>
      </div>

      {/* Staff Members List Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Section Top Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              IT & Support Staff Performance List ({filteredStaff.length} Members)
            </h2>
            <p className="text-xs text-gray-500">
              Only IT & Support role staff members are listed with their total, daily, and monthly purchased conversions.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Staff Table / Cards */}
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-medium">Loading purchased statistics...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-xs font-medium">
            {error}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            No IT & Support staff members found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 text-gray-500 uppercase font-semibold text-[11px] border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Role / Department</th>
                  <th className="px-5 py-3.5 text-center">Day ({new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})</th>
                  <th className="px-5 py-3.5 text-center">Month ({new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'short' })})</th>
                  <th className="px-5 py-3.5 text-center">Total Purchased</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((staff, idx) => {
                  const isTopPerformer = idx === 0 && staff.totalPurchased > 0;
                  return (
                    <tr
                      key={staff._id || staff.name}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Staff Name & Email */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shadow-2xs border ${
                            isTopPerformer
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {isTopPerformer ? (
                              <Trophy className="w-4 h-4 text-amber-600" />
                            ) : (
                              staff.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>{staff.name}</span>
                              {isTopPerformer && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-200">
                                  #1 Rank
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">{staff.email || 'No email registered'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Department / Designation */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {staff.department || 'IT and support'}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">
                          {staff.designation || 'IT Support'}
                        </div>
                      </td>

                      {/* Day's Purchased */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg text-xs font-bold ${
                            staff.todayPurchased > 0
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {staff.todayPurchased}
                        </span>
                      </td>

                      {/* Month's Purchased */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg text-xs font-bold ${
                            staff.monthPurchased > 0
                              ? 'bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {staff.monthPurchased}
                        </span>
                      </td>

                      {/* Total Purchased */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-xl text-xs font-extrabold shadow-2xs ${
                            staff.totalPurchased > 0
                              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {staff.totalPurchased}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setSelectedStaffForModal(staff);
                            setModalFilter('ALL');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <span>View Students ({staff.totalPurchased})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchased Students Modal Details */}
      {selectedStaffForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center shadow-md shadow-emerald-600/20">
                  {selectedStaffForModal.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span>{selectedStaffForModal.name}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      {selectedStaffForModal.totalPurchased} Total Purchased
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedStaffForModal.department} • {selectedStaffForModal.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStaffForModal(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModalFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalFilter === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({selectedStaffForModal.totalPurchased})
                </button>
                <button
                  onClick={() => setModalFilter('TODAY')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalFilter === 'TODAY'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Day ({selectedStaffForModal.todayPurchased})
                </button>
                <button
                  onClick={() => setModalFilter('MONTH')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalFilter === 'MONTH'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Month ({selectedStaffForModal.monthPurchased})
                </button>
              </div>

              <span className="text-[11px] text-gray-400">
                Showing {modalStudents.length} student records
              </span>
            </div>

            {/* Modal Body / Students List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {modalStudents.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                  <span>No purchased student records found for the selected period.</span>
                </div>
              ) : (
                modalStudents.map((st) => (
                  <div
                    key={st._id || st.inquiryId}
                    className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs hover:border-emerald-300 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                          {st.inquiryId}
                        </span>
                        <span className="font-bold text-sm text-gray-900">{st.studentName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-300">
                          <ShoppingBag className="w-3 h-3" />
                          Purchased
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {new Date(st.date || st.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Course / Subject */}
                    {st.subject && (
                      <div className="text-xs font-semibold text-gray-800 bg-slate-50 p-2 rounded-xl border border-gray-100">
                        {st.subject}
                      </div>
                    )}

                    {/* Phone & Actions */}
                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-gray-700 font-medium flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {st.mobileNumber}
                        </span>
                        <a
                          href={`https://wa.me/91${st.mobileNumber.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                          WhatsApp
                        </a>
                      </div>

                      {st.remark && (
                        <div className="text-[11px] text-gray-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          <strong>Note:</strong> {st.remark}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedStaffForModal(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
