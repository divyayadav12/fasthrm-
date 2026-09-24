import React, { useEffect, useState, useMemo } from 'react';
import { X, Clock, Calendar, CheckCircle, Briefcase, Activity, ExternalLink, ChevronRight, Filter, AlertCircle, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { formatDuration, getTaskLiveMinutes } from '../utils/timeFormat';

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
    officeStartTime?: string;
    officeEndTime?: string;
  } | null;
  initialLogs?: any[];
  onSelectTask?: (task: { taskId?: string; title: string; employee?: any }) => void;
}

interface TaskReportItem {
  _id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  totalMinutes: number;
  startedAt?: string;
  completedAt?: string;
  lastActivity?: string;
  logCount: number;
  createdAt: string;
}

export const EmployeeHistoryDrawer: React.FC<EmployeeHistoryDrawerProps> = ({
  isOpen,
  onClose,
  employee,
  initialLogs = [],
  onSelectTask,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');
  const [logs, setLogs] = useState<any[]>([]);
  const [taskReports, setTaskReports] = useState<TaskReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
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

  // Fetch WorkLogs and Task Report for this employee
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

    if (empId) {
      setLoading(true);
      setTaskLoading(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };

      // 1. Fetch worklogs
      axios
        .get(`${API_URL}/work-logs/employee/${empId}?limit=300`, config)
        .then((res) => {
          const serverLogs = res.data?.workLogs || [];
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
          console.warn('Failed to fetch employee work logs', err);
        })
        .finally(() => {
          setLoading(false);
        });

      // 2. Fetch task time breakdown report for this employee
      let taskReportUrl = `${API_URL}/reports/my-tasks?employeeId=${empId}`;
      if (dateFilter === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        taskReportUrl += `&dateFrom=${d.toISOString()}`;
      } else if (dateFilter === 'yesterday') {
        const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        taskReportUrl += `&dateFrom=${d.toISOString()}&dateTo=${end.toISOString()}`;
      } else if (dateFilter === '7days') {
        const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
        taskReportUrl += `&dateFrom=${d.toISOString()}`;
      } else if (dateFilter === 'custom') {
        if (customFrom) taskReportUrl += `&dateFrom=${new Date(customFrom).toISOString()}`;
        if (customTo) {
          const to = new Date(customTo); to.setHours(23, 59, 59, 999);
          taskReportUrl += `&dateTo=${to.toISOString()}`;
        }
      }

      axios
        .get(taskReportUrl, config)
        .then((res) => {
          setTaskReports(res.data?.tasks || []);
        })
        .catch((err) => {
          console.warn('Failed to fetch employee task breakdown', err);
        })
        .finally(() => {
          setTaskLoading(false);
        });
    }
  }, [employee, isOpen, user?.token, dateFilter, customFrom, customTo]);

  // Quick Date Filter Calculation + IDLE Gaps for Activity Log
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const baseFiltered = logs.filter((log) => {
      const logDate = new Date(log.createdAt);

      if (dateFilter === 'today') return logDate.toDateString() === todayStr;
      if (dateFilter === 'yesterday') return logDate.toDateString() === yesterdayStr;
      if (dateFilter === '7days') return logDate >= sevenDaysAgo;
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

    const getVirtualGaps = (dayLogs: any[]) => {
      // Sort chronologically for gap analysis
      dayLogs.sort((a, b) => new Date(a.startTime || a.createdAt).getTime() - new Date(b.startTime || b.createdAt).getTime());
      
      const finalLogs: any[] = [];
      const [startH, startM] = (employee?.officeStartTime || '10:05').split(':').map(Number);
      const [endH, endM] = (employee?.officeEndTime || '19:05').split(':').map(Number);
      
      const days = new Set(dayLogs.map(l => new Date(l.startTime || l.createdAt).toDateString()));
      
      days.forEach(dateStr => {
        const d = new Date(dateStr);
        const shiftStart = new Date(d); shiftStart.setHours(startH, startM, 0, 0);
        const shiftEnd = new Date(d); shiftEnd.setHours(endH, endM, 0, 0);
        const now = new Date();
        const limit = Math.min(shiftEnd.getTime(), now.getTime());
        
        let cursor = shiftStart.getTime();
        const logsForDay = dayLogs.filter(l => new Date(l.startTime || l.createdAt).toDateString() === dateStr);
        
        logsForDay.forEach((log) => {
          const st = new Date(log.startTime || log.createdAt).getTime();
          let durMins = log.duration || log.durationMinutes || 0;
          const isLatestOverall = log._id === logs[0]?._id;
          if (log.status === 'WORKING' && isLatestOverall) {
            durMins = Math.max(1, Math.floor((Date.now() - st) / 60000));
          }
          const et = st + durMins * 60000;

          if (st > cursor + 60000 && st <= limit) {
             finalLogs.push({
               _id: `idle-${cursor}`,
               isVirtual: true,
               createdAt: new Date(cursor).toISOString(),
               startTime: new Date(cursor).toISOString(),
               duration: Math.floor((Math.min(st, limit) - cursor) / 60000),
               status: 'IDLE',
               customTaskTitle: 'IDLE',
               description: 'No active task'
             });
          }
          finalLogs.push({ ...log });
          cursor = Math.max(cursor, et);
        });

        if (cursor + 60000 < limit) {
           finalLogs.push({
               _id: `idle-${cursor}-end`,
               isVirtual: true,
               createdAt: new Date(cursor).toISOString(),
               startTime: new Date(cursor).toISOString(),
               duration: Math.floor((limit - cursor) / 60000),
               status: 'IDLE',
               customTaskTitle: 'IDLE',
               description: 'No active task'
           });
        }
      });

      finalLogs.sort((a, b) => new Date(b.startTime || b.createdAt).getTime() - new Date(a.startTime || a.createdAt).getTime());
      return finalLogs;
    };

    return getVirtualGaps(baseFiltered);
  }, [logs, dateFilter, customFrom, customTo, employee]);

  // Filtered Task Breakdown items
  const filteredTasks = useMemo(() => {
    return taskReports;
  }, [taskReports]);

  // Derived Stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const taskTitles = new Set<string>();
    let completedCount = 0;
    let workingCount = 0;

    // Use task reports if available for total accumulated task time, otherwise calculate from logs
    if (taskReports.length > 0 && dateFilter === 'all') {
      taskReports.forEach(t => {
        totalMinutes += t.totalMinutes || 0;
        taskTitles.add(t.title);
        if (t.status === 'COMPLETED') completedCount++;
        if (t.status === 'WORKING') workingCount++;
      });
    } else {
      filteredLogs.forEach((log) => {
        if (log.status === 'IDLE') return;
        let dur = log.duration || log.durationMinutes || 0;
        const isLatestOverall = log._id === logs[0]?._id;
        if (log.status === 'WORKING' && isLatestOverall) {
          const startTime = log.startTime ? new Date(log.startTime) : new Date(log.createdAt);
          dur = Math.max(1, Math.floor((new Date().getTime() - startTime.getTime()) / 60000));
        }
        if (dur) totalMinutes += Number(dur);
        const title = log.taskId?.title || log.customTaskTitle;
        if (title) taskTitles.add(title);
        if (log.status === 'COMPLETED') completedCount++;
        if (log.status === 'WORKING') workingCount++;
      });
    }

    const formattedDuration = formatDuration(totalMinutes);

    return {
      totalTasks: taskTitles.size || taskReports.length,
      completedCount,
      workingCount,
      totalDuration: formattedDuration,
      totalMinutes,
      totalLogs: filteredLogs.length,
    };
  }, [filteredLogs, taskReports, dateFilter]);

  const maxTaskMinutes = useMemo(() => {
    return Math.max(...taskReports.map((t) => t.totalMinutes), 1);
  }, [taskReports]);

  if (!isOpen || !employee) return null;

  // Latest status and task
  const latestLog = logs[0];
  const currentStatus = employee?.status || latestLog?.status || 'OFFLINE';
  const currentTaskTitle = employee?.currentTask || latestLog?.taskId?.title || latestLog?.customTaskTitle || null;

  const getStatusBadge = (status: string, taskTitle?: string) => {
    const styles: Record<string, string> = {
      WORKING: 'bg-blue-50 text-blue-700 border-blue-200',
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      IN_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
      ON_HOLD: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
      BLOCKED: 'bg-red-50 text-red-700 border-red-200',
      NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-200',
      IDLE: 'bg-gray-50 text-gray-500 border-gray-200 border-dashed',
    };
    
    let displayStatus = status;
    if (taskTitle && taskTitle.trim().toLowerCase() === 'lunch break') {
      if (status === 'WORKING') displayStatus = 'LUNCH START';
      if (status === 'COMPLETED') displayStatus = 'LUNCH END';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
        {status === 'WORKING' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />}
        {status === 'COMPLETED' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />}
        {displayStatus}
      </span>
    );
  };

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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-base sm:text-lg flex items-center justify-center border border-indigo-100 shadow-xs flex-shrink-0">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{employee.name}</h2>
                    {getStatusBadge(currentStatus, currentTaskTitle)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {employee.designation || employee.department || 'Team Member'} {employee.email ? `· ${employee.email}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0 ml-2"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Active Task Banner */}
            {currentTaskTitle && (
              <div className="mt-3.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">Current Task</p>
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

            {/* Summary Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-gray-100">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 text-center">
                <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Total Time</p>
                <p className="text-sm font-bold text-indigo-700 mt-0.5">{stats.totalDuration}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 text-center">
                <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Tasks</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.totalTasks}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 text-center">
                <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Completed</p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{stats.completedCount}</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs + Filter Bar */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* View Tabs */}
            <div className="inline-flex p-0.5 bg-gray-100 rounded-xl">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'tasks' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Task Breakdown ({taskReports.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'logs' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Activity Log ({filteredLogs.length})</span>
              </button>
            </div>

            {/* Date Filters */}
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {(['all', 'today', 'yesterday', '7days', 'custom'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setDateFilter(filterKey)}
                  className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-colors flex-shrink-0 ${
                    dateFilter === filterKey
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filterKey === '7days' ? 'Last 7 Days' : filterKey}
                </button>
              ))}
              {(loading || taskLoading) && (
                <span className="flex items-center text-xs text-gray-400 ml-1">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                </span>
              )}
            </div>
          </div>

          {/* Custom Date Inputs if active */}
          {dateFilter === 'custom' && (
            <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2 text-xs">
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

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-slate-50/40">
            {activeTab === 'tasks' ? (
              /* TAB 1: TASK TIME BREAKDOWN (Exactly matching Employee Report) */
              taskLoading && taskReports.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-xs">Loading task breakdown...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No tasks found for this period</p>
                  <p className="text-xs text-gray-400 mt-1">Try selecting "All" or a different date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50/80 font-semibold text-gray-600 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th scope="col" className="px-4 py-3">Task Name</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Status</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Time Spent</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap w-36">Time Bar</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Last Activity</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredTasks.map((task) => {
                        const isWorking = task.status === 'WORKING';
                        const barWidth = Math.max(4, Math.round((task.totalMinutes / maxTaskMinutes) * 100));
                        const formattedDur = formatDuration(task.totalMinutes);

                        return (
                          <tr key={task._id} className="hover:bg-indigo-50/30 transition-colors group">
                            {/* Task Name */}
                            <td className="px-4 py-3.5">
                              <span
                                onClick={() => {
                                  if (onSelectTask) {
                                    onSelectTask({
                                      taskId: task._id,
                                      title: task.title,
                                      employee,
                                    });
                                  }
                                }}
                                className="font-semibold text-gray-900 hover:text-indigo-600 cursor-pointer hover:underline inline-flex items-center group-hover:text-indigo-600"
                                title="Click to view task details"
                              >
                                {task.title}
                                <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-60 group-hover:opacity-100 text-indigo-500 transition-opacity flex-shrink-0" />
                              </span>
                              {task.description && (
                                <p className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5">
                                  {task.description}
                                </p>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {getStatusBadge(task.status, task.title)}
                            </td>

                            {/* Time Spent */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                              {isWorking ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                  {formattedDur} (LIVE)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-gray-800 font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  {formattedDur}
                                </span>
                              )}
                            </td>

                            {/* Time Bar */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    isWorking ? 'bg-blue-500 animate-pulse' : task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-400'
                                  }`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 mt-0.5 block">{formattedDur}</span>
                            </td>

                            {/* Last Activity */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                              {task.lastActivity ? (
                                <div>
                                  <p className="font-medium text-gray-800">
                                    {new Date(task.lastActivity).toLocaleDateString(undefined, {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    {new Date(task.lastActivity).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* Progress */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      task.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${task.progress || 0}%` }}
                                  />
                                </div>
                                <span className="text-gray-700 font-semibold text-[11px]">
                                  {task.progress || 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* TAB 2: ACTIVITY TIMELINE / LOGS (Accurate chronological entries) */
              filteredLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No activity logged for this period</p>
                  <p className="text-xs text-gray-400 mt-1">Try selecting "All" or a different date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50/80 font-semibold text-gray-600 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Date</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Timing</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Time Spent</th>
                        <th scope="col" className="px-4 py-3">Task</th>
                        <th scope="col" className="px-4 py-3">Description</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredLogs.map((log) => {
                        const logDate = new Date(log.startTime || log.createdAt);
                        const formattedDate = logDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const logTime = logDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const taskTitle = log.taskId?.title || log.customTaskTitle || 'General Work';
                        
                        let durationMins = log.duration || log.durationMinutes || 0;
                        const isLatestOverall = log._id === logs[0]?._id;
                        const isLiveWorking = log.status === 'WORKING' && isLatestOverall;
                        if (isLiveWorking) {
                          const startTime = log.startTime ? new Date(log.startTime) : new Date(log.createdAt);
                          durationMins = Math.max(1, Math.floor((Date.now() - startTime.getTime()) / 60000));
                        }
                        
                        let durationStr = '0m';
                        if (durationMins > 0) {
                          durationStr = formatDuration(durationMins);
                          if (isLiveWorking) durationStr += ' (LIVE)';
                        } else if (log.status !== 'WORKING' && !log.duration) {
                          durationStr = '-';
                        }

                        return (
                          <tr key={log._id} className={`transition-colors group ${log.isVirtual ? 'bg-gray-50/50 hover:bg-gray-50' : 'hover:bg-indigo-50/30'}`}>
                            {/* Date */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                              {formattedDate}
                            </td>

                            {/* Timing */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-semibold text-gray-900">{logTime}</span>
                            </td>

                            {/* Time Spent */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                              {isLiveWorking ? (
                                <span className="text-blue-600 font-bold">{durationStr}</span>
                              ) : durationMins > 0 ? (
                                <span className="text-gray-800 font-semibold">{durationStr}</span>
                              ) : (
                                <span className="text-gray-400 font-normal">{durationStr}</span>
                              )}
                            </td>

                            {/* Task */}
                            <td className="px-4 py-3.5">
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
                                className="font-semibold text-gray-900 hover:text-indigo-600 cursor-pointer hover:underline inline-flex items-center group-hover:text-indigo-600"
                                title="Click to view task history"
                              >
                                {taskTitle}
                                <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-60 group-hover:opacity-100 text-indigo-500 transition-opacity flex-shrink-0" />
                              </span>
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
                              {getStatusBadge(log.status, log.taskId?.title || log.customTaskTitle)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-400">
            <span>
              {activeTab === 'tasks'
                ? `Showing ${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`
                : `Showing ${filteredLogs.length} activity records`}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
