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
  isResumedTask?: boolean;
  originalStartedAt?: string;
  dayMinutes?: number;
  st?: number;
  et?: number;
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

  const formatDateSubtext = (dateVal?: string | Date | null) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Quick Date Filter Calculation + IDLE Gaps for Activity Log (Strictly Deduplicated)
  const filteredLogs = useMemo(() => {
    const [startH, startM] = (employee?.officeStartTime || '10:00').split(':').map(Number);
    const [endH, endM] = (employee?.officeEndTime || '19:00').split(':').map(Number);

    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawLogs = logs.filter((log) => {
      const isWorking = log.status === 'WORKING';
      const logDate = new Date(log.startTime || log.createdAt);

      if (dateFilter === 'today') {
        return isWorking || logDate.toDateString() === todayStr;
      }
      if (dateFilter === 'yesterday') {
        return logDate.toDateString() === yesterdayStr;
      }
      if (dateFilter === '7days') return isWorking || logDate >= sevenDaysAgo;
      if (dateFilter === 'custom') {
        if (customFrom && logDate < new Date(customFrom) && !isWorking) return false;
        if (customTo) {
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (logDate > to && !isWorking) return false;
        }
        return true;
      }
      return true;
    });

    const logMap = new Map<string, any>();
    rawLogs.forEach((l) => {
      if (l._id && !logMap.has(l._id)) {
        logMap.set(l._id, l);
      }
    });
    const uniqueLogs = Array.from(logMap.values());

    const daysSet = new Set<string>();
    if (dateFilter === 'today') {
      daysSet.add(todayStr);
    } else if (dateFilter === 'yesterday') {
      daysSet.add(yesterdayStr);
    } else {
      uniqueLogs.forEach((l) => {
        const dStr = new Date(l.startTime || l.createdAt).toDateString();
        daysSet.add(dStr);
      });
      if (daysSet.size === 0) daysSet.add(todayStr);
    }

    const idleLogs: any[] = [];

    daysSet.forEach((dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      const shiftStart = new Date(d);
      shiftStart.setHours(startH || 10, startM || 0, 0, 0);

      const shiftEnd = new Date(d);
      shiftEnd.setHours(endH || 19, endM || 0, 0, 0);

      const isToday = d.toDateString() === todayStr;
      const limit = isToday ? Math.min(shiftEnd.getTime(), Date.now()) : shiftEnd.getTime();

      if (isToday && Date.now() < shiftStart.getTime()) return;

      const logsForDay = uniqueLogs
        .filter((l) => {
          const lTime = new Date(l.startTime || l.createdAt);
          if (lTime.toDateString() === dateStr) return true;
          if (l.status === 'WORKING' && isToday) return true;
          return false;
        })
        .sort((a, b) => {
          const tA = new Date(a.startTime || a.createdAt).getTime();
          const tB = new Date(b.startTime || b.createdAt).getTime();
          return tA - tB;
        });

      let cursor = shiftStart.getTime();

      logsForDay.forEach((log) => {
        let st = new Date(log.startTime || log.createdAt).getTime();
        if (isToday && st < shiftStart.getTime() && log.status === 'WORKING') {
          st = Math.max(st, shiftStart.getTime());
        }

        let durMins = log.duration || log.durationMinutes || 0;
        const isLatestOverall = log._id === logs[0]?._id;
        if (log.status === 'WORKING' && isLatestOverall) {
          durMins = Math.max(1, Math.floor((Date.now() - st) / 60000));
        }
        const et = st + Math.max(1, durMins) * 60000;

        if (st > cursor + 120000 && cursor < limit) {
          const idleEnd = Math.min(st, limit);
          const idleDur = Math.floor((idleEnd - cursor) / 60000);
          if (idleDur >= 2) {
            idleLogs.push({
              _id: `idle-log-${dateStr}-${cursor}`,
              isVirtual: true,
              createdAt: new Date(cursor).toISOString(),
              startTime: new Date(cursor).toISOString(),
              endTime: new Date(idleEnd).toISOString(),
              duration: idleDur,
              status: 'IDLE',
              customTaskTitle: 'IDLE',
              description: 'No active task logged',
            });
          }
        }
        cursor = Math.max(cursor, et);
      });

      if (cursor + 120000 < limit) {
        const idleDur = Math.floor((limit - cursor) / 60000);
        if (idleDur >= 2) {
          idleLogs.push({
            _id: `idle-log-${dateStr}-${cursor}-end`,
            isVirtual: true,
            createdAt: new Date(cursor).toISOString(),
            startTime: new Date(cursor).toISOString(),
            endTime: new Date(limit).toISOString(),
            duration: idleDur,
            status: 'IDLE',
            customTaskTitle: 'IDLE',
            description: 'No active task logged',
          });
        }
      }
    });

    const combined = [...uniqueLogs, ...idleLogs];
    return combined.sort(
      (a, b) =>
        new Date(b.startTime || b.createdAt).getTime() -
        new Date(a.startTime || a.createdAt).getTime()
    );
  }, [logs, dateFilter, customFrom, customTo, employee]);

  // Filtered Task Breakdown items + IDLE Gaps (Strictly Deduplicated & Session-Aware)
  // Filtered Task Breakdown items + IDLE Gaps (Strictly Deduplicated & Session-Aware)
  const filteredTasks = useMemo(() => {
    const [startH, startM] = (employee?.officeStartTime || '10:00').split(':').map(Number);
    const [endH, endM] = (employee?.officeEndTime || '19:00').split(':').map(Number);

    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawTasks = taskReports.filter((task) => {
      const isWorking = task.status === 'WORKING';
      const taskStart = new Date(task.startedAt || task.createdAt);
      const taskLast = task.lastActivity ? new Date(task.lastActivity) : taskStart;
      const taskComp = task.completedAt ? new Date(task.completedAt) : taskLast;

      const hasMatchingLogOnDate = (dStr: string) => {
        return logs.some((l) => {
          const lTime = new Date(l.startTime || l.createdAt);
          const lTaskId = typeof l.taskId === 'object' ? l.taskId?._id : l.taskId;
          const isMatch =
            (lTaskId && task._id && lTaskId.toString() === task._id.toString()) ||
            (l.customTaskTitle && task.title && l.customTaskTitle.trim().toLowerCase() === task.title.trim().toLowerCase());
          return isMatch && lTime.toDateString() === dStr;
        });
      };

      if (isWorking) return true;

      if (dateFilter === 'today') {
        return (
          taskStart.toDateString() === todayStr ||
          taskLast.toDateString() === todayStr ||
          taskComp.toDateString() === todayStr ||
          hasMatchingLogOnDate(todayStr)
        );
      }
      if (dateFilter === 'yesterday') {
        return (
          taskStart.toDateString() === yesterdayStr ||
          taskLast.toDateString() === yesterdayStr ||
          taskComp.toDateString() === yesterdayStr ||
          hasMatchingLogOnDate(yesterdayStr)
        );
      }
      if (dateFilter === '7days') return taskLast >= sevenDaysAgo || taskStart >= sevenDaysAgo;
      if (dateFilter === 'custom') {
        if (customFrom && taskLast < new Date(customFrom)) return false;
        if (customTo) {
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (taskStart > to) return false;
        }
        return true;
      }
      return true;
    });

    const taskMap = new Map<string, TaskReportItem>();
    rawTasks.forEach((t) => {
      const normTitle = (t.title || '').trim().toLowerCase();
      if (!normTitle) return;
      if (!taskMap.has(normTitle)) {
        taskMap.set(normTitle, { ...t });
      } else {
        const existing = taskMap.get(normTitle)!;
        existing.totalMinutes = (existing.totalMinutes || 0) + (t.totalMinutes || 0);
        if (t.startedAt && (!existing.startedAt || new Date(t.startedAt) < new Date(existing.startedAt))) {
          existing.startedAt = t.startedAt;
        }
        if (t.status === 'WORKING') {
          existing.status = 'WORKING';
        }
      }
    });

    // Also include task logs (e.g. Lunch Break) not present in taskReports
    logs.forEach((l) => {
      const title = l.taskId?.title || l.customTaskTitle;
      if (!title) return;
      const normTitle = title.trim().toLowerCase();
      const lTime = new Date(l.startTime || l.createdAt);

      if (!taskMap.has(normTitle)) {
        let dur = l.duration || l.durationMinutes || 0;
        if (l.status === 'WORKING') {
          dur = Math.max(1, Math.floor((Date.now() - lTime.getTime()) / 60000));
        }
        taskMap.set(normTitle, {
          _id: l.taskId?._id || `log-task-${normTitle}`,
          title: title,
          description: l.description || (normTitle === 'lunch break' ? 'Meal and rest break' : ''),
          status: l.status || 'COMPLETED',
          progress: l.status === 'COMPLETED' ? 100 : 50,
          totalMinutes: dur,
          startedAt: lTime.toISOString(),
          completedAt: l.endTime ? new Date(l.endTime).toISOString() : undefined,
          lastActivity: lTime.toISOString(),
          logCount: 1,
          createdAt: lTime.toISOString(),
        });
      }
    });

    const uniqueBaseTasks = Array.from(taskMap.values());

    const daysSet = new Set<string>();
    if (dateFilter === 'today') {
      daysSet.add(todayStr);
    } else if (dateFilter === 'yesterday') {
      daysSet.add(yesterdayStr);
    } else {
      uniqueBaseTasks.forEach((t) => {
        const dStr = new Date(t.startedAt || t.createdAt).toDateString();
        daysSet.add(dStr);
      });
      logs.forEach((l) => {
        const dStr = new Date(l.startTime || l.createdAt).toDateString();
        daysSet.add(dStr);
      });
      if (daysSet.size === 0) daysSet.add(todayStr);
    }

    const allFinalItems: TaskReportItem[] = [];
    const addedItemKeys = new Set<string>();

    daysSet.forEach((dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      const shiftStart = new Date(d);
      shiftStart.setHours(startH || 10, startM || 0, 0, 0);

      const shiftEnd = new Date(d);
      shiftEnd.setHours(endH || 19, endM || 0, 0, 0);

      const isToday = d.toDateString() === todayStr;
      const limit = isToday ? Math.min(shiftEnd.getTime(), Date.now()) : shiftEnd.getTime();

      if (isToday && Date.now() < shiftStart.getTime()) return;

      const rawWorkIntervals: { st: number; et: number }[] = [];

      uniqueBaseTasks.forEach((t) => {
        const matchingLogs = logs.filter((l) => {
          const lTaskId = typeof l.taskId === 'object' ? l.taskId?._id : l.taskId;
          if (lTaskId && t._id && lTaskId.toString() === t._id.toString()) return true;
          if (l.customTaskTitle && t.title && l.customTaskTitle.trim().toLowerCase() === t.title.trim().toLowerCase()) return true;
          return false;
        });

        const logsOnDay = matchingLogs.filter((l) => {
          const lTime = new Date(l.startTime || l.createdAt);
          if (lTime.toDateString() === dateStr) return true;
          if (l.status === 'WORKING' && isToday) return true;
          return false;
        });

        const tStart = new Date(t.startedAt || t.createdAt);
        const tComp = t.completedAt ? new Date(t.completedAt) : null;
        const isTaskCreatedOnDay = tStart.toDateString() === dateStr;
        const isTaskCompletedOnDay = tComp ? tComp.toDateString() === dateStr : false;
        const isTaskWorkingToday = t.status === 'WORKING' && isToday;

        const belongsToDay = isTaskCreatedOnDay || isTaskCompletedOnDay || isTaskWorkingToday || logsOnDay.length > 0;

        if (belongsToDay) {
          if (logsOnDay.length > 0) {
            logsOnDay.forEach((l) => {
              let st = new Date(l.startTime || l.createdAt).getTime();
              let durMins = l.duration || l.durationMinutes || 0;
              const isLatestOverall = l._id === logs[0]?._id;
              if (l.status === 'WORKING' && isLatestOverall) {
                durMins = Math.max(1, Math.floor((Date.now() - st) / 60000));
              }
              let et = st + Math.max(1, durMins) * 60000;
              rawWorkIntervals.push({ st, et });
            });
          } else {
            let st = tStart.getTime();
            let et = isTaskWorkingToday
              ? Date.now()
              : tComp
              ? tComp.getTime()
              : st + Math.max(1, t.totalMinutes || 0) * 60000;

            if (!isTaskCreatedOnDay && (isTaskCompletedOnDay || isTaskWorkingToday)) {
              st = Math.max(shiftStart.getTime(), et - Math.max(1, t.totalMinutes || 60) * 60000);
            }
            if (et > st) {
              rawWorkIntervals.push({ st, et });
            }
          }

          const normTitle = t.title.trim().toLowerCase();
          if (!addedItemKeys.has(normTitle)) {
            addedItemKeys.add(normTitle);

            // Calculate precise dayMinutes for today / selected day
            let dayMins = 0;
            const logsOnToday = matchingLogs.filter((l) => {
              const lTime = new Date(l.startTime || l.createdAt);
              return lTime.toDateString() === todayStr || (l.status === 'WORKING' && isToday);
            });

            if (logsOnToday.length > 0) {
              logsOnToday.forEach((l) => {
                let st = new Date(l.startTime || l.createdAt).getTime();
                let durMins = l.duration || l.durationMinutes || 0;
                const isLatestOverall = l._id === logs[0]?._id;
                if (l.status === 'WORKING' && isLatestOverall) {
                  durMins = Math.max(1, Math.floor((Date.now() - st) / 60000));
                }
                dayMins += durMins;
              });
            } else if (t.status === 'WORKING') {
              const activeLog = logs.find((l) => l.status === 'WORKING');
              let activeSt = Date.now();
              if (activeLog && (activeLog.startTime || activeLog.createdAt)) {
                const logTime = new Date(activeLog.startTime || activeLog.createdAt).getTime();
                if (new Date(logTime).toDateString() === todayStr) {
                  activeSt = logTime;
                }
              } else if (tStart && tStart.toDateString() === todayStr) {
                activeSt = tStart.getTime();
              }
              dayMins = Math.max(1, Math.floor((Date.now() - activeSt) / 60000));
            } else if (tStart.toDateString() === todayStr) {
              dayMins = t.totalMinutes || 0;
            }

            let calculatedTotalMinutes = t.totalMinutes || 0;
            if (t.status === 'WORKING' && dayMins > 0) {
              calculatedTotalMinutes = Math.max(calculatedTotalMinutes, dayMins);
            }

            allFinalItems.push({
              ...t,
              dayMinutes: dayMins,
              totalMinutes: calculatedTotalMinutes,
            });
          }
        }
      });

      rawWorkIntervals.sort((a, b) => a.st - b.st);
      const mergedWorkIntervals: { st: number; et: number }[] = [];
      rawWorkIntervals.forEach((interval) => {
        if (mergedWorkIntervals.length === 0) {
          mergedWorkIntervals.push({ ...interval });
        } else {
          const last = mergedWorkIntervals[mergedWorkIntervals.length - 1];
          if (interval.st <= last.et + 60000) {
            last.et = Math.max(last.et, interval.et);
          } else {
            mergedWorkIntervals.push({ ...interval });
          }
        }
      });

      let cursor = shiftStart.getTime();
      mergedWorkIntervals.forEach((session) => {
        if (session.st > cursor + 120000 && cursor < limit) {
          const idleEnd = Math.min(session.st, limit);
          const durMins = Math.floor((idleEnd - cursor) / 60000);
          if (durMins >= 2) {
            const idleKey = `idle-${dateStr}-${cursor}`;
            if (!addedItemKeys.has(idleKey)) {
              addedItemKeys.add(idleKey);
              allFinalItems.push({
                _id: idleKey,
                title: 'IDLE',
                description: 'No active task being tracked',
                status: 'IDLE',
                progress: 0,
                totalMinutes: durMins,
                startedAt: new Date(cursor).toISOString(),
                completedAt: new Date(idleEnd).toISOString(),
                lastActivity: new Date(idleEnd).toISOString(),
                logCount: 0,
                createdAt: new Date(cursor).toISOString(),
                st: cursor,
                et: idleEnd,
              });
            }
          }
        }
        cursor = Math.max(cursor, session.et);
      });

      if (cursor + 120000 < limit) {
        const durMins = Math.floor((limit - cursor) / 60000);
        if (durMins >= 2) {
          const idleEndKey = `idle-${dateStr}-${cursor}-end`;
          if (!addedItemKeys.has(idleEndKey)) {
            addedItemKeys.add(idleEndKey);
            allFinalItems.push({
              _id: idleEndKey,
              title: 'IDLE',
              description: 'No active task being tracked',
              status: 'IDLE',
              progress: 0,
              totalMinutes: durMins,
              startedAt: new Date(cursor).toISOString(),
              completedAt: new Date(limit).toISOString(),
              lastActivity: new Date(limit).toISOString(),
              logCount: 0,
              createdAt: new Date(cursor).toISOString(),
              st: cursor,
              et: limit,
            });
          }
        }
      }
    });

    return allFinalItems.sort((a, b) => {
      const getTime = (item: TaskReportItem) => {
        if (item.status === 'WORKING') return Date.now();
        if (item.st) return item.st;
        if (item.startedAt) return new Date(item.startedAt).getTime();
        if (item.createdAt) return new Date(item.createdAt).getTime();
        return 0;
      };
      return getTime(b) - getTime(a);
    });
  }, [taskReports, logs, dateFilter, customFrom, customTo, employee]);

  // Derived Stats
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const taskTitles = new Set<string>();
    let completedCount = 0;
    let workingCount = 0;

    if (taskReports.length > 0 && dateFilter === 'all') {
      taskReports.forEach((t) => {
        if (t.status === 'IDLE') return;
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
      totalTasks: taskTitles.size || taskReports.filter((t) => t.status !== 'IDLE').length,
      completedCount,
      workingCount,
      totalDuration: formattedDuration,
      totalMinutes,
      totalLogs: filteredLogs.filter((l) => l.status !== 'IDLE').length,
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
      IDLE: 'bg-amber-50 text-amber-700 border-amber-300 border-dashed font-bold',
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
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Start Time</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">End Time</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Today's Time</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Total Time</th>
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

                        const taskStart = task.startedAt || task.createdAt;
                        const taskEnd = isWorking ? null : (task.completedAt || task.lastActivity);

                        const formattedStartTime = taskStart
                          ? new Date(taskStart).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '-';

                        const formattedEndTime = isWorking
                          ? 'In Progress'
                          : taskEnd
                          ? new Date(taskEnd).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '-';

                        return (
                          <tr key={task._id} className={`transition-colors group ${task.status === 'IDLE' ? 'bg-amber-50/25 hover:bg-amber-50/50 border-l-4 border-l-amber-400' : 'hover:bg-indigo-50/30'}`}>
                            {/* Task Name */}
                            <td className="px-4 py-3.5">
                              {task.status === 'IDLE' ? (
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                                    <span className="font-bold text-amber-900 tracking-wide text-xs">IDLE (UN-TRACKED TIME GAP)</span>
                                  </div>
                                  <p className="text-[11px] text-amber-700/80 truncate max-w-xs mt-0.5">
                                    {task.description || 'No active task logged during this period'}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center flex-wrap gap-1">
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
                                    {task.status !== 'IDLE' && taskStart && new Date(taskStart).toDateString() !== (new Date()).toDateString() && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 inline-flex items-center gap-1 flex-shrink-0">
                                        <Calendar className="w-2.5 h-2.5 text-amber-600" />
                                        Started {formatDateSubtext(taskStart)}
                                      </span>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {getStatusBadge(task.status, task.title)}
                            </td>

                            {/* Start Time + Date Subtext */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col items-start">
                                <span className="font-semibold text-gray-900 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200/80">
                                  {formattedStartTime}
                                </span>
                                {taskStart && (
                                  <span className="text-[10px] text-gray-500 font-medium mt-0.5 pl-0.5">
                                    {formatDateSubtext(taskStart)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* End Time + Date Subtext */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col items-start">
                                {isWorking ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 animate-pulse">
                                      In Progress
                                    </span>
                                    <span className="text-[10px] text-blue-600/70 font-medium mt-0.5 pl-0.5">
                                      {formatDateSubtext(taskStart || new Date())}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-semibold text-gray-900 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200/80">
                                      {formattedEndTime}
                                    </span>
                                    {taskEnd && (
                                      <span className="text-[10px] text-gray-500 font-medium mt-0.5 pl-0.5">
                                        {formatDateSubtext(taskEnd)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Today's Time */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                              {isWorking ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                  {formatDuration(task.dayMinutes || task.totalMinutes)} (LIVE)
                                </span>
                              ) : task.status === 'IDLE' ? (
                                <span className="inline-flex items-center gap-1 text-gray-500 font-medium italic">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  {formattedDur}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100">
                                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                  {formatDuration(task.dayMinutes || task.totalMinutes)}
                                </span>
                              )}
                            </td>

                            {/* Total Time */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                              {task.status === 'IDLE' ? (
                                <span className="text-gray-400 font-medium italic">-</span>
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
                                    task.status === 'IDLE'
                                      ? 'bg-gray-300'
                                      : isWorking
                                      ? 'bg-blue-500 animate-pulse'
                                      : task.status === 'COMPLETED'
                                      ? 'bg-emerald-500'
                                      : 'bg-indigo-400'
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
                              {task.status === 'IDLE' ? (
                                <span className="text-gray-400 font-normal text-[11px]">-</span>
                              ) : (
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
                              )}
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
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">Start Time</th>
                        <th scope="col" className="px-4 py-3 whitespace-nowrap">End Time</th>
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

                        let startDateObj = logDate;
                        let endDateObj: Date | null = null;
                        if (log.endTime) {
                          endDateObj = new Date(log.endTime);
                        } else if (durationMins > 0) {
                          endDateObj = new Date(log.createdAt || logDate);
                          startDateObj = log.startTime ? new Date(log.startTime) : new Date(endDateObj.getTime() - durationMins * 60000);
                        } else {
                          endDateObj = logDate;
                        }

                        const formattedStartTime = startDateObj.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });

                        const formattedEndTime = isLiveWorking
                          ? 'In Progress'
                          : endDateObj
                          ? endDateObj.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '-';

                        return (
                          <tr key={log._id} className={`transition-colors group ${log.isVirtual ? 'bg-gray-50/50 hover:bg-gray-50' : 'hover:bg-indigo-50/30'}`}>
                            {/* Date */}
                            <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700">
                              {formattedDate}
                            </td>

                            {/* Start Time + Date Subtext */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col items-start">
                                <span className="font-semibold text-gray-900 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200/80">
                                  {formattedStartTime}
                                </span>
                                {startDateObj && (
                                  <span className="text-[10px] text-gray-500 font-medium mt-0.5 pl-0.5">
                                    {formatDateSubtext(startDateObj)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* End Time + Date Subtext */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col items-start">
                                {isLiveWorking ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 animate-pulse">
                                      In Progress
                                    </span>
                                    <span className="text-[10px] text-blue-600/70 font-medium mt-0.5 pl-0.5">
                                      {formatDateSubtext(startDateObj || new Date())}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-semibold text-gray-900 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200/80">
                                      {formattedEndTime}
                                    </span>
                                    {endDateObj && (
                                      <span className="text-[10px] text-gray-500 font-medium mt-0.5 pl-0.5">
                                        {formatDateSubtext(endDateObj)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
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
