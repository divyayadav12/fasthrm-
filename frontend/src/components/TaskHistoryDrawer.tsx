import React, { useEffect, useState, useMemo } from 'react';
import { X, Clock, Calendar, CheckCircle2, User, FileText, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatDuration, getTaskLiveMinutes } from '../utils/timeFormat';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

interface TaskHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    _id?: string;
    taskId?: string;
    title: string;
    employee?: any;
    status?: string;
    totalDuration?: number;
    startedAt?: string | Date;
  } | null;
  initialLogs?: any[];
  onSelectEmployee?: (employee: any) => void;
}

export const TaskHistoryDrawer: React.FC<TaskHistoryDrawerProps> = ({
  isOpen,
  onClose,
  task,
  initialLogs = [],
  onSelectEmployee,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [logs, setLogs] = useState<any[]>([]);
  const [taskDetails, setTaskDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // false = newest first, true = oldest first

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

  // Seed logs instantly from live dashboard, then fetch server data
  useEffect(() => {
    if (!task || !isOpen) return;

    const taskTitle = task.title?.trim().toLowerCase();
    const taskId = task.taskId;

    // Fast initial filter from live dashboard logs
    const seed = initialLogs.filter((log) => {
      const logTaskId = log.taskId?._id || log.taskId;
      const logTitle = (log.taskId?.title || log.customTaskTitle || '').trim().toLowerCase();
      return (taskId && logTaskId === taskId) || (taskTitle && logTitle === taskTitle);
    });
    setLogs(seed);

    // Fetch full task history from server
    const queryTarget = taskId || encodeURIComponent(task.title);
    if (queryTarget) {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };

      axios
        .get(`${API_URL}/work-logs/task/${queryTarget}?limit=200`, config)
        .then((res) => {
          const serverLogs = res.data?.workLogs || [];
          if (res.data?.task) {
            setTaskDetails(res.data.task);
          }
          // Deduplicate
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
          console.warn('Failed to fetch full task history', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [task, isOpen, user?.token]);

  // Sorted logs
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return sortAsc ? tA - tB : tB - tA;
    });
  }, [logs, sortAsc]);

  // Derived Task Metrics
  const metrics = useMemo(() => {
    let totalMinutes = 0;
    const employeesMap = new Map<string, any>();

    logs.forEach((log) => {
      const dur = log.duration ?? log.durationMinutes;
      if (dur) totalMinutes += Number(dur);
      if (log.employeeId) {
        const id = log.employeeId?._id || log.employeeId?.name || log.employeeId;
        employeesMap.set(id, log.employeeId);
      }
    });

    if (task) {
      const liveMinutes = getTaskLiveMinutes(task);
      if (liveMinutes > totalMinutes) {
        totalMinutes = liveMinutes;
      }
    }

    const formattedDuration = formatDuration(totalMinutes);

    const earliestLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const latestLog = logs.length > 0 ? logs[0] : null;

    return {
      totalDuration: formattedDuration,
      updateCount: logs.length,
      startedAt: earliestLog ? new Date(earliestLog.createdAt) : (task?.startedAt ? new Date(task.startedAt) : null),
      lastUpdatedAt: latestLog ? new Date(latestLog.createdAt) : null,
      currentStatus: latestLog?.status || task?.status || 'IN_PROGRESS',
      contributingEmployees: Array.from(employeesMap.values()),
    };
  }, [logs, task]);

  if (!isOpen || !task) return null;

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

  const assignedEmployee = task.employee || (metrics.contributingEmployees[0] || null);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full sm:max-w-3xl lg:max-w-4xl w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div className="w-full bg-white shadow-2xl border-l border-gray-200 flex flex-col pointer-events-auto transform transition-all duration-300 ease-in-out">
          
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Task History
                  </span>
                  {getStatusBadge(metrics.currentStatus)}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug break-words">
                  {task.title}
                </h2>
                {taskDetails?.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {taskDetails.description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Assigned / Active Employee Card */}
            {assignedEmployee && (
              <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {(typeof assignedEmployee === 'object' ? assignedEmployee.name : String(assignedEmployee)).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-medium">Assigned / Logged by</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {typeof assignedEmployee === 'object' ? assignedEmployee.name : assignedEmployee}
                    </p>
                  </div>
                </div>
                {onSelectEmployee && (
                  <button
                    onClick={() => onSelectEmployee(assignedEmployee)}
                    className="flex-shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs hover:bg-indigo-50/50 transition-colors flex items-center space-x-1"
                  >
                    <span>View Profile</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Filter & Sort Bar */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 bg-white flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Task Progression Timeline
            </span>
            <div className="flex items-center space-x-3 text-xs">
              {loading && (
                <span className="flex items-center text-xs text-gray-400">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Loading...
                </span>
              )}
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center"
              >
                {sortAsc ? 'Oldest first ↑' : 'Newest first ↓'}
              </button>
            </div>
          </div>

          {/* Scrollable Table Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-slate-50/40">
            {sortedLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No updates logged yet for this task</p>
                <p className="text-xs text-gray-400 mt-1">Updates will appear here when an employee starts or updates work on it.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/80 font-semibold text-gray-600 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Timing</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Time Spent</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Employee</th>
                      <th scope="col" className="px-4 py-3">Description</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sortedLogs.map((log, index) => {
                      const logDate = new Date(log.createdAt);
                      const formattedDate = logDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const formattedTime = logDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const employeeName = log.employeeId?.name || (typeof assignedEmployee === 'object' ? assignedEmployee?.name : assignedEmployee) || 'Team Member';

                      return (
                        <tr key={log._id || index} className="hover:bg-indigo-50/30 transition-colors group">
                          {/* Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                            {formattedDate}
                          </td>

                          {/* Timing */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{formattedTime}</span>
                          </td>

                          {/* Time Spent */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                            {(log.duration || log.durationMinutes) > 0 ? (
                              <div className="inline-flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200/70 px-2 py-1 rounded-md font-semibold">
                                <Clock className="w-3 h-3 text-gray-400" />
                                {formatDuration(log.duration || log.durationMinutes)}
                              </div>
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>

                          {/* Employee */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-800">
                            <div className="flex items-center space-x-2">
                              <div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                {employeeName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-900">{employeeName}</span>
                            </div>
                          </td>

                          {/* Description */}
                          <td className="px-4 py-3.5 text-gray-600 max-w-xs break-words">
                            {log.description ? (
                              <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs text-gray-700 font-normal leading-relaxed">
                                {log.description}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {getStatusBadge(log.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-400">
            <span>{sortedLogs.length} total status updates recorded</span>
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
