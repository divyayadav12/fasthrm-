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

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: any) => (e: any) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-100 text-blue-800',
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_REVIEW: 'bg-purple-100 text-purple-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      BLOCKED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">Live Status:</span>
          <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            socketStatus === 'Connected' ? 'bg-green-100 text-green-800' :
            socketStatus === 'Connecting' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {socketStatus === 'Connected' && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              </>
            )}
            {socketStatus}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Employees */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <p className="text-2xl font-semibold text-gray-900">{totalEmployees || employees.length}</p>
          </div>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Completed Today</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.completedTasksToday || 0}</p>
          </div>
        </div>

        {/* Currently Working */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Currently Working</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.currentlyWorking || 0}</p>
          </div>
        </div>
      </div>

      {/* Live Team Status Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">LIVE TEAM STATUS</h2>
          <span className="flex items-center text-sm font-medium text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
            Auto-updating
          </span>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center px-3 py-1.5 border border-red-300 rounded-lg bg-red-50 text-sm text-red-600 hover:bg-red-100">
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500">
            Showing {filteredActivity.length} records
          </span>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name</label>
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={filterEmployee}
                  onChange={handleFilterChange(setFilterEmployee)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={handleFilterChange(setFilterStatus)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="WORKING">Working</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="NOT_STARTED">Not Started</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={handleFilterChange(setFilterDateFrom)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={handleFilterChange(setFilterDateTo)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No activity found.
                  </td>
                </tr>
              ) : (
                paginatedActivity.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                          {log.employeeId?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{log.employeeId?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">{log.employeeId?.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      {log.taskId?.title || log.customTaskTitle || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              {' '}({filteredActivity.length} total)
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`flex items-center px-3 py-1.5 border rounded-md text-sm ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 3),
                Math.min(totalPages, currentPage + 2)
              ).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-md text-sm font-medium ${page === currentPage ? 'bg-indigo-600 text-white' : 'text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`flex items-center px-3 py-1.5 border rounded-md text-sm ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
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
