import React, { useEffect, useState, useMemo } from 'react';
import { X, Clock, Calendar, CheckCircle, Briefcase, Activity, ExternalLink, ChevronRight, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

interface EmployeeHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    _id?: string;
    id?: string;
    name: string;
    email?: string;
    department?: string;
    designation?: string;
    status?: string;
    currentTask?: string;
  } | null;
  initialLogs?: any[];
  onSelectTask?: (task: { taskId?: string; title: string; employee?: any }) => void;
}

export const EmployeeHistoryDrawer: React.FC<EmployeeHistoryDrawerProps> = ({
  isOpen,
  onClose,
  employee,
  initialLogs = [],
  onSelectTask,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Seed logs from initialLogs instantly, then fetch full history
  useEffect(() => {
    if (!employee || !isOpen) return;

    const empId = employee._id || employee.id;
    const empName = employee.name?.toLowerCase().trim();

    // Instant local filter from live dashboard logs
    const seed = initialLogs.filter((log) => {
      const logEmpId = log.employeeId?._id || log.employeeId;
      const logEmpName = (typeof log.employeeId === 'object' ? log.employeeId?.name : '') || '';
      return (empId && logEmpId === empId) || (empName && logEmpName.toLowerCase().trim() === empName);
    });
    setLogs(seed);

    // If we have an ID or name, fetch full employee history from server
    if (empId) {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      axios
        .get(`${API_URL}/work-logs/employee/${empId}?limit=300`, config)
        .then((res) => {
          const serverLogs = res.data?.workLogs || [];
          // Deduplicate merging with seed
          const map = new Map();
          [...serverLogs, ...seed].forEach((l) => {
            if (l._id) map.set(l._id, l);
          });
          const combined = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLogs(combined);
        })
        .catch((err) => {
          console.warn('Failed to fetch full employee history', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [employee, isOpen, user?.token]);

  // Quick Date Filter Calculation
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return logs.filter((log) => {
      const logDate = new Date(log.createdAt);

      if (dateFilter === 'today') {
        return logDate.toDateString() === todayStr;
      }
      if (dateFilter === 'yesterday') {
        return logDate.toDateString() === yesterdayStr;
      }
      if (dateFilter === '7days') {
        return logDate >= sevenDaysAgo;
      }
      if (dateFilter === 'custom') {
        if (customFrom && logDate < new Date(customFrom)) return false;
        if (customTo) {
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (logDate > to) return false;
        }
        return true;
      }
      return true;
    });
  }, [logs, dateFilter, customFrom, customTo]);

  // Derived Stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const taskTitles = new Set<string>();
    let completedCount = 0;
    let workingCount = 0;

    filteredLogs.forEach((log) => {
      if (log.durationMinutes) totalMinutes += Number(log.durationMinutes);
      const title = log.taskId?.title || log.customTaskTitle;
      if (title) taskTitles.add(title);
      if (log.status === 'COMPLETED') completedCount++;
      if (log.status === 'WORKING') workingCount++;
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      totalTasks: taskTitles.size,
      completedCount,
      workingCount,
      totalDuration: totalMinutes > 0 ? formattedDuration : '0m',
      totalLogs: filteredLogs.length,
    };
  }, [filteredLogs]);

  // Group logs by readable date string
  const groupedLogs = useMemo(() => {
    const groups: { [date: string]: any[] } = {};
    filteredLogs.forEach((log) => {
      const dateObj = new Date(log.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let key = dateObj.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      if (dateObj.toDateString() === today.toDateString()) {
        key = `Today · ${key}`;
      } else if (dateObj.toDateString() === yesterday.toDateString()) {
        key = `Yesterday · ${key}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return groups;
  }, [filteredLogs]);

  // Most current status & task from latest log
  const latestLog = logs[0];
  const currentStatus = employee?.status || latestLog?.status || 'OFFLINE';
  const currentTaskTitle = employee?.currentTask || latestLog?.taskId?.title || latestLog?.customTaskTitle || null;

  if (!isOpen || !employee) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      WORKING: 'bg-blue-50 text-blue-700 border-blue-200',
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      IN_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
      ON_HOLD: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
      BLOCKED: 'bg-red-50 text-red-700 border-red-200',
      NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
        {status === 'WORKING' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />}
        {status === 'COMPLETED' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />}
        {status}
      </span>
    );
  };

  const getTimelineDot = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'bg-blue-500 ring-4 ring-blue-100';
      case 'COMPLETED':
        return 'bg-emerald-500 ring-4 ring-emerald-100';
      case 'IN_REVIEW':
        return 'bg-purple-500 ring-4 ring-purple-100';
      case 'ON_HOLD':
        return 'bg-yellow-500 ring-4 ring-yellow-100';
      case 'BLOCKED':
        return 'bg-red-500 ring-4 ring-red-100';
      default:
        return 'bg-gray-400 ring-4 ring-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-2xl w-full flex pl-10 pointer-events-none">
        <div className="w-full bg-white shadow-2xl border-l border-gray-200 flex flex-col pointer-events-auto transform transition-all duration-300 ease-in-out">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-lg flex items-center justify-center border border-indigo-100 shadow-xs">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-gray-900">{employee.name}</h2>
                    {getStatusBadge(currentStatus)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {employee.designation || employee.department || 'Team Member'} {employee.email ? `· ${employee.email}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Active Task Banner */}
            {currentTaskTitle && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Current Task</p>
                    <p className="text-sm font-medium text-blue-950 truncate">{currentTaskTitle}</p>
                  </div>
                </div>
                {onSelectTask && (
                  <button
                    onClick={() => onSelectTask({ title: currentTaskTitle, employee })}
                    className="flex-shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-xs flex items-center space-x-1 hover:bg-blue-50 transition-colors"
                  >
                    <span>View Task</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100 grid grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Tasks</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.totalTasks}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Completed</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.completedCount}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Working</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">{stats.workingCount}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Logged Time</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.totalDuration}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
              {(['all', 'today', 'yesterday', '7days', 'custom'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setDateFilter(filterKey)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    dateFilter === filterKey
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filterKey === '7days' ? 'Last 7 Days' : filterKey}
                </button>
              ))}
            </div>

            {loading && (
              <span className="flex items-center text-xs text-gray-400">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </span>
            )}
          </div>

          {/* Custom Date Inputs if active */}
          {dateFilter === 'custom' && (
            <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500 font-medium">From:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs"
                />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500 font-medium">To:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs"
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  onClick={() => {
                    setCustomFrom('');
                    setCustomTo('');
                  }}
                  className="text-red-500 hover:text-red-700 font-semibold"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Scrollable Timeline Area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50/40">
            {filteredLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No activity logged for this period</p>
                <p className="text-xs text-gray-400 mt-1">Try selecting "All" or a different date range.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedLogs).map(([dateLabel, dateLogs]) => (
                  <div key={dateLabel} className="space-y-3">
                    {/* Date Section Header */}
                    <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-xs py-1">
                      <span className="inline-flex items-center text-xs font-bold text-gray-600 bg-white px-3 py-1 rounded-lg border border-gray-200/80 shadow-2xs">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                        {dateLabel}
                      </span>
                    </div>

                    {/* Timeline entries */}
                    <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                      {dateLogs.map((log) => {
                        const logTime = new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const taskTitle = log.taskId?.title || log.customTaskTitle || 'General Work';

                        return (
                          <div key={log._id} className="relative group">
                            {/* Dot */}
                            <div
                              className={`absolute -left-6 top-3 w-2.5 h-2.5 rounded-full ${getTimelineDot(
                                log.status
                              )}`}
                            />

                            {/* Card */}
                            <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs hover:border-indigo-100 hover:shadow-xs transition-all">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-gray-900">{logTime}</span>
                                    {getStatusBadge(log.status)}
                                    {log.durationMinutes > 0 && (
                                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md flex items-center">
                                        <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                        {log.durationMinutes}m
                                      </span>
                                    )}
                                  </div>

                                  {/* Clickable Task Title */}
                                  <div className="mt-1.5 flex items-center">
                                    <span
                                      onClick={() => {
                                        if (onSelectTask) {
                                          onSelectTask({
                                            taskId: log.taskId?._id || log.taskId,
                                            title: taskTitle,
                                            employee,
                                          });
                                        }
                                      }}
                                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer flex items-center group-hover:underline"
                                    >
                                      {taskTitle}
                                      <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                                    </span>
                                  </div>

                                  {/* Description / Notes */}
                                  {log.description && (
                                    <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 p-2 rounded-lg border border-gray-100 font-normal">
                                      {log.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-400">
            <span>Showing {filteredLogs.length} activity records</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
