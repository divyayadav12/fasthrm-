import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchDashboardStats, fetchRecentActivity, addLiveActivity } from '../../store/slices/dashboardSlice';
import { fetchEmployees } from '../../store/slices/employeeSlice';
import { socket } from '../../utils/socket';
import { CheckCircle, Users, Activity, Filter, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const AdminDashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { stats, liveActivity, isLoading } = useSelector((state: RootState) => state.dashboard);
  const { employees, total: totalEmployees } = useSelector((state: RootState) => state.employees);
  const [socketStatus, setSocketStatus] = useState<'Connecting' | 'Connected' | 'Reconnecting' | 'Offline'>('Connecting');

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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

  const activeFilterCount = [filterEmployee, filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  const clearFilters = () => {
    setFilterEmployee('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
  };

  const filteredActivity = useMemo(() => {
    return liveActivity.filter((log) => {
      if (filterEmployee && !log.employeeId?.name?.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
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
  }, [liveActivity, filterEmployee, filterStatus, filterDateFrom, filterDateTo]);

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-400">Live Status:</span>
          <div className="flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            Connected
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Employees */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Employees</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalEmployees || employees.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Registered staff</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 ml-4">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed Today</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{completedTodayCount}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Successfully closed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 ml-4">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Currently Working */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Currently Working</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{currentlyWorkingCount}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Active right now</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Live Team Status Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 tracking-wide">LIVE TEAM STATUS</h2>
          <span className="flex items-center text-sm font-medium text-emerald-600">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            Auto-updating
          </span>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 border rounded-xl text-sm font-medium transition-colors shadow-xs ${
              showFilters || activeFilterCount > 0
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-2 text-gray-500" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">{activeFilterCount}</span>
            )}
            <ChevronDown className={`h-4 w-4 ml-1.5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center px-3.5 py-2 border border-red-200 rounded-xl bg-red-50 text-sm text-red-600 hover:bg-red-100 transition-colors">
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No activity found.
                  </td>
                </tr>
              ) : (
                paginatedActivity.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mr-3">
                          {log.employeeId?.name?.charAt(0).toLowerCase() || 'u'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{log.employeeId?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{log.employeeId?.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium max-w-xs truncate">
                      {log.taskId?.title || log.customTaskTitle || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-normal">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredActivity.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-800">{currentPage}</span> of <span className="font-semibold text-gray-800">{Math.max(1, totalPages)}</span>
              {' '}({filteredActivity.length} total records)
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`flex items-center px-3.5 py-1.5 border rounded-xl text-sm font-medium transition-colors ${currentPage === 1 ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </button>
              {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 3),
                Math.min(Math.max(1, totalPages), currentPage + 2)
              ).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-xl text-sm font-semibold transition-colors ${page === currentPage ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                disabled={currentPage >= totalPages}
                className={`flex items-center px-3.5 py-1.5 border rounded-xl text-sm font-medium transition-colors ${currentPage >= totalPages ? 'text-gray-300 border-gray-100 cursor-not-allowed' : 'text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
