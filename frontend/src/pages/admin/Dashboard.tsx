import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchDashboardStats, fetchRecentActivity, addLiveActivity } from '../../store/slices/dashboardSlice';
import { fetchEmployees } from '../../store/slices/employeeSlice';
import { socket } from '../../utils/socket';
import { CheckCircle, Users, Activity, Filter, X, ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { EmployeeHistoryDrawer } from '../../components/EmployeeHistoryDrawer';
import { TaskHistoryDrawer } from '../../components/TaskHistoryDrawer';

const ITEMS_PER_PAGE = 10;
const ROLE_TABS = ['All', 'Editor DTP', 'IT and support', 'Others', 'IOA', 'Career'] as const;

const AdminDashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { stats, liveActivity, isLoading } = useSelector((state: RootState) => state.dashboard);
  const { employees, total: totalEmployees } = useSelector((state: RootState) => state.employees);
  const [socketStatus, setSocketStatus] = useState<'Connecting' | 'Connected' | 'Reconnecting' | 'Offline'>('Connecting');

  // History Drawer states
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Filter states
  const [selectedRoleTab, setSelectedRoleTab] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Helper function to match employee role/department flexibly
  const isRoleMatch = (empDept: string, targetRole: string) => {
    const dept = (empDept || '').trim().toLowerCase();
    const target = targetRole.trim().toLowerCase();

    if (target === 'all') return true;

    // Editor DTP
    if (target === 'editor dtp') {
      return dept.includes('editor') || dept.includes('dtp');
    }

    // IT and support: must NOT match editor
    if (target === 'it and support' || target === 'it & support') {
      if (dept.includes('editor') || dept.includes('dtp')) return false;
      return (
        dept === 'it and support' ||
        dept === 'it & support' ||
        dept.includes('support') ||
        /\b(it)\b/i.test(dept)
      );
    }

    // IOA
    if (target === 'ioa') {
      return dept === 'ioa' || /\b(ioa)\b/i.test(dept);
    }

    // Career
    if (target === 'career' || target === 'careear') {
      return dept.includes('career') || dept.includes('careear');
    }

    // Others
    if (target === 'others' || target === 'other') {
      const isKnown =
        dept.includes('editor') ||
        dept.includes('dtp') ||
        dept.includes('support') ||
        /\b(it)\b/i.test(dept) ||
        dept === 'ioa' ||
        /\b(ioa)\b/i.test(dept) ||
        dept.includes('career') ||
        dept.includes('careear');
      return !isKnown || dept.includes('other');
    }

    return dept === target;
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchRecentActivity());
    dispatch(fetchEmployees({ limit: 200 }));

    if (!socket.connected) socket.connect();

    const onConnect = () => setSocketStatus('Connected');
    const onDisconnect = () => setSocketStatus('Offline');
    const onWorkLogUpdated = (data: any) => {
      dispatch(addLiveActivity(data));
      dispatch(fetchDashboardStats());
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('worklog_updated', onWorkLogUpdated);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('worklog_updated', onWorkLogUpdated);
    };
  }, [dispatch]);

  const activeFilterCount = [filterEmployee, filterTask, filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  const clearFilters = () => {
    setFilterEmployee('');
    setFilterTask('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSelectedRoleTab('All');
    setCurrentPage(1);
  };

  const filteredActivity = useMemo(() => {
    return liveActivity.filter((log) => {
      // Role Filter Tab
      if (selectedRoleTab !== 'All') {
        const empId = log.employeeId?._id || log.employeeId;
        const employeeObj = employees.find(e => e._id === empId) || (typeof log.employeeId === 'object' ? log.employeeId : null);
        const empDept = employeeObj?.department || employeeObj?.designation || log.employeeId?.department || '';
        if (!isRoleMatch(empDept, selectedRoleTab)) return false;
      }
      if (filterEmployee && !log.employeeId?.name?.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
      if (filterTask) {
        const title = (log.taskId?.title || log.customTaskTitle || '').toLowerCase();
        if (!title.includes(filterTask.toLowerCase())) return false;
      }
      if (filterStatus && log.status !== filterStatus) return false;
      if (filterDateFrom) {
        const logDate = new Date(log.createdAt);
        if (logDate < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const logDate = new Date(log.createdAt);
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59);
        if (logDate > to) return false;
      }
      return true;
    });
  }, [liveActivity, employees, selectedRoleTab, filterEmployee, filterTask, filterStatus, filterDateFrom, filterDateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredActivity.length / ITEMS_PER_PAGE);
  const paginatedActivity = filteredActivity.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate completed tasks today with fallback to liveActivity
  const completedTodayCount = useMemo(() => {
    const today = new Date();
    const completedFromLive = liveActivity.filter((log) => {
      if (log.status !== 'COMPLETED') return false;
      const d = new Date(log.createdAt);
      return d.toDateString() === today.toDateString();
    });

    const uniqueCompleted = new Set(
      completedFromLive.map(l => l.taskId?._id || l.taskId || l.customTaskTitle || l._id)
    ).size;

    return Math.max(stats?.completedTasksToday || 0, uniqueCompleted);
  }, [stats?.completedTasksToday, liveActivity]);

  // Calculate currently working with fallback to liveActivity
  const currentlyWorkingCount = useMemo(() => {
    const today = new Date();
    const todayLogs = liveActivity.filter((log) => {
      const d = new Date(log.createdAt);
      return d.toDateString() === today.toDateString();
    });

    const employeeLatestStatus: Record<string, string> = {};
    todayLogs.forEach((log) => {
      const empId = log.employeeId?._id || log.employeeId?.name || log._id;
      if (!employeeLatestStatus[empId]) {
        employeeLatestStatus[empId] = log.status;
      }
    });

    const workingFromLive = Object.values(employeeLatestStatus).filter(s => s === 'WORKING').length;
    return Math.max(stats?.currentlyWorking || 0, workingFromLive);
  }, [stats?.currentlyWorking, liveActivity]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: any) => (e: any) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  // Quick Date presets
  const handleQuickDatePreset = (preset: 'today' | 'yesterday' | '7days' | 'all') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setFilterDateFrom(todayStr);
      setFilterDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setFilterDateFrom(yStr);
      setFilterDateTo(yStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFilterDateFrom(formatDate(past));
      setFilterDateTo(formatDate(today));
    } else {
      setFilterDateFrom('');
      setFilterDateTo('');
    }
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-50 text-blue-600',
      NOT_STARTED: 'bg-gray-100 text-gray-600',
      IN_REVIEW: 'bg-purple-50 text-purple-600',
      ON_HOLD: 'bg-yellow-50 text-yellow-700',
      PENDING: 'bg-orange-50 text-orange-600',
      BLOCKED: 'bg-red-50 text-red-600',
      COMPLETED: 'bg-emerald-50 text-emerald-600',
    };
    return (
      <span className={`px-3 py-1 inline-flex text-xs font-bold tracking-wider uppercase rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-400">Live Status:</span>
          <div className="flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            Connected
          </div>
        </div>
      </div>



      {/* Live Team Status Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-wide">LIVE TEAM STATUS</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click on any employee or task to inspect instant chronological history</p>
          </div>
          <span className="flex items-center text-sm font-medium text-emerald-600 self-start sm:self-auto">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            Auto-updating
          </span>
        </div>

        {/* Filter Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-3 sm:px-3.5 py-1.5 border rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-xs shrink-0 ${
                showFilters || activeFilterCount > 0
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-gray-500" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 bg-indigo-600 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">{activeFilterCount}</span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Role Filter Tabs beside Filters */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              {ROLE_TABS.map((roleTab) => {
                const isActive = selectedRoleTab === roleTab;
                return (
                  <button
                    key={roleTab}
                    onClick={() => {
                      setSelectedRoleTab(roleTab);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    {roleTab}
                  </button>
                );
              })}
            </div>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center px-2.5 py-1.5 border border-red-200 rounded-xl bg-red-50 text-xs text-red-600 hover:bg-red-100 transition-colors shrink-0">
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </button>
            )}
          </div>

          {/* Quick Date Shortcuts */}
          <div className="flex items-center space-x-1.5 text-xs overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-gray-400 font-medium mr-1 hidden sm:inline flex-shrink-0">Quick dates:</span>
            <button
              onClick={() => handleQuickDatePreset('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${!filterDateFrom && !filterDateTo ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              All
            </button>
            <button
              onClick={() => handleQuickDatePreset('today')}
              className="px-2.5 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDatePreset('yesterday')}
              className="px-2.5 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              Yesterday
            </button>
            <button
              onClick={() => handleQuickDatePreset('7days')}
              className="px-2.5 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              Last 7 Days
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50/70 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Employee Name</label>
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={filterEmployee}
                  onChange={handleFilterChange(setFilterEmployee)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="Search task..."
                  value={filterTask}
                  onChange={handleFilterChange(setFilterTask)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={handleFilterChange(setFilterStatus)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="WORKING">Working</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="PENDING">Pending</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={handleFilterChange(setFilterDateFrom)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={handleFilterChange(setFilterDateTo)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No activity found.
                  </td>
                </tr>
              ) : (
                paginatedActivity.map((log) => {
                  const employeeName = log.employeeId?.name || 'Unknown';
                  const taskTitle = log.taskId?.title || log.customTaskTitle || '-';
                  const empId = log.employeeId?._id || log.employeeId;
                  const employeeObj = employees.find(e => e._id === empId) || (typeof log.employeeId === 'object' ? log.employeeId : null);
                  const empRole = employeeObj?.department || employeeObj?.designation || log.employeeId?.department || '';

                  return (
                    <tr key={log._id} className="hover:bg-indigo-50/30 transition-colors group">
                      {/* Employee Column - Clickable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          onClick={() => setSelectedEmployee({
                            _id: empId,
                            name: employeeName,
                            email: log.employeeId?.email || '',
                            department: empRole || log.employeeId?.department,
                            designation: employeeObj?.designation || log.employeeId?.designation,
                            status: log.status,
                            currentTask: taskTitle !== '-' ? taskTitle : undefined,
                          })}
                          className="flex items-center cursor-pointer group/emp w-fit"
                          title="Click to view employee profile & complete history"
                        >
                          <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mr-3 group-hover/emp:bg-indigo-600 group-hover/emp:text-white transition-colors shrink-0">
                            {employeeName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 group-hover/emp:text-indigo-600 group-hover/emp:underline transition-colors">
                            {employeeName}
                          </span>
                        </div>
                      </td>

                      {/* Task Column - Clickable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {taskTitle !== '-' ? (
                          <div
                            onClick={() => setSelectedTask({
                              taskId: log.taskId?._id || log.taskId,
                              title: taskTitle,
                              employee: log.employeeId,
                              status: log.status,
                            })}
                            className="text-sm text-gray-800 hover:text-indigo-600 font-medium max-w-xs truncate cursor-pointer hover:underline flex items-center space-x-1.5"
                            title="Click to view dedicated task history"
                          >
                            <span>{taskTitle}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* Last Updated Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-normal">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      {/* Quick History Actions Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedEmployee({
                              _id: log.employeeId?._id || log.employeeId,
                              name: employeeName,
                              email: log.employeeId?.email || '',
                              department: log.employeeId?.department,
                              designation: log.employeeId?.designation,
                              status: log.status,
                              currentTask: taskTitle !== '-' ? taskTitle : undefined,
                            })}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 transition-colors flex items-center"
                            title="View Employee History"
                          >
                            <History className="h-3.5 w-3.5 mr-1" />
                            Employee
                          </button>

                          {taskTitle !== '-' && (
                            <button
                              onClick={() => setSelectedTask({
                                taskId: log.taskId?._id || log.taskId,
                                title: taskTitle,
                                employee: log.employeeId,
                                status: log.status,
                              })}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center"
                              title="View Task History"
                            >
                              <History className="h-3.5 w-3.5 mr-1" />
                              Task
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredActivity.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <p className="text-xs sm:text-sm text-gray-500">
              Page <span className="font-semibold text-gray-800">{currentPage}</span> of <span className="font-semibold text-gray-800">{Math.max(1, totalPages)}</span>
              {' '}({filteredActivity.length} total records)
            </p>
            <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`flex items-center px-2.5 sm:px-3.5 py-1.5 border rounded-xl text-xs sm:text-sm font-medium transition-colors ${currentPage === 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Prev
              </button>
              {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 2),
                Math.min(Math.max(1, totalPages), currentPage + 2)
              ).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center ${page === currentPage ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                disabled={currentPage >= totalPages}
                className={`flex items-center px-2.5 sm:px-3.5 py-1.5 border rounded-xl text-xs sm:text-sm font-medium transition-colors ${currentPage >= totalPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                Next <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Employee History Slide-over Drawer */}
      <EmployeeHistoryDrawer
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
        initialLogs={liveActivity}
        onSelectTask={(task) => {
          setSelectedEmployee(null);
          setSelectedTask(task);
        }}
      />

      {/* Dedicated Task History Slide-over Drawer */}
      <TaskHistoryDrawer
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        initialLogs={liveActivity}
        onSelectEmployee={(emp) => {
          setSelectedTask(null);
          setSelectedEmployee(emp);
        }}
      />
    </div>
  );
};

export default AdminDashboard;
