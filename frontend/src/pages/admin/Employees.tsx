import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployees } from '../../store/slices/employeeSlice';
import { RootState, AppDispatch } from '../../store';
import { Search, Filter, Eye, Edit, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmployeesList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { employees, total, isLoading } = useSelector((state: RootState) => state.employees);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterEmail, setFilterEmail] = useState('');

  useEffect(() => {
    dispatch(fetchEmployees({ limit: 200 }));
  }, [dispatch]);

  const activeFilterCount = [filterRole, filterStatus, filterDateFrom, filterDateTo, filterEmail].filter(Boolean).length;

  const clearFilters = () => {
    setFilterRole('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterEmail('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Client-side filtering
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Name/email search
      const search = searchTerm.toLowerCase();
      if (search && !(
        emp.name?.toLowerCase().includes(search) ||
        emp.email?.toLowerCase().includes(search)
      )) return false;

      // Email filter
      if (filterEmail && !emp.email?.toLowerCase().includes(filterEmail.toLowerCase())) return false;

      // Role filter
      if (filterRole && emp.role !== filterRole) return false;

      // Status filter
      if (filterStatus === 'active' && !emp.isActive) return false;
      if (filterStatus === 'inactive' && emp.isActive) return false;

      // Date from
      if (filterDateFrom) {
        const joined = new Date(emp.createdAt);
        const from = new Date(filterDateFrom);
        if (joined < from) return false;
      }

      // Date to
      if (filterDateTo) {
        const joined = new Date(emp.createdAt);
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59);
        if (joined > to) return false;
      }

      return true;
    });
  }, [employees, searchTerm, filterEmail, filterRole, filterStatus, filterDateFrom, filterDateTo]);

  // Pagination slice
  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900">Employees ({filteredEmployees.length})</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search + Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-3">
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center px-3.5 py-2 border border-red-200 rounded-xl bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                <X className="h-4 w-4 mr-1" />
                Clear ({activeFilterCount})
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-2 border rounded-xl text-sm font-medium transition-colors shadow-xs ${
                showFilters || activeFilterCount > 0
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2 text-gray-500" />
              Filters {activeFilterCount > 0 && <span className="ml-1.5 bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">{activeFilterCount}</span>}
              <ChevronDown className={`h-4 w-4 ml-1.5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Email Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="text"
                  placeholder="Filter by email..."
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="EMPLOYEE">Employee</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Joined Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Joined From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Joined To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading employees...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No employees found.</td></tr>
              ) : (
                paginatedEmployees.map((employee) => (
                  <tr key={employee._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mr-3">
                          {employee.name?.charAt(0).toLowerCase() || 'u'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{employee.name || 'Unknown User'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700 font-medium">{employee.designation || employee.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs font-bold tracking-wider uppercase rounded-full ${
                        employee.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(employee.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end">
                        <Link to={`/admin/employees/${employee._id}`} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-xl transition-colors" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredEmployees.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-800">{currentPage}</span> of <span className="font-semibold text-gray-800">{Math.max(1, totalPages)}</span>
              {' '}({filteredEmployees.length} total employees)
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

export default EmployeesList;
