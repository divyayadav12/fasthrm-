import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { Calendar, Filter, Edit2, RotateCcw, X, Check, ArrowRight, Activity, AlertCircle, HelpCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const WorkHistory = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Edit Modal state
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState('WORKING');
  const [editDescription, setEditDescription] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [editRestartReason, setEditRestartReason] = useState('');
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Restart Reason Modal state
  const [restartingLog, setRestartingLog] = useState<any | null>(null);
  const [restartReason, setRestartReason] = useState('');
  const [restartReasonError, setRestartReasonError] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; actionLabel?: string; actionHref?: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, filter, page]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      
      let url = `${API_URL}/work-logs/employee/${user?._id}?limit=20&page=${page}`;
      
      if (filter === 'today') {
        const today = new Date();
        today.setHours(0,0,0,0);
        url += `&dateFrom=${today.toISOString()}`;
      } else if (filter === 'week') {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        url += `&dateFrom=${week.toISOString()}`;
      } else if (filter === 'month') {
        const month = new Date();
        month.setDate(1);
        url += `&dateFrom=${month.toISOString()}`;
      }
      
      const response = await axios.get(url, config);
      setWorkLogs(response.data.workLogs);
      setHasMore(response.data.workLogs.length === 20);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-100 text-blue-800 border-blue-200',
      COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      IN_REVIEW: 'bg-purple-100 text-purple-800 border-purple-200',
      ON_HOLD: 'bg-amber-100 text-amber-800 border-amber-200',
      PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
      NOT_STARTED: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {status}
      </span>
    );
  };

  // Open edit modal pre-filled
  const openEditModal = (log: any) => {
    setEditingLog(log);
    setEditTitle(log.taskId?.title || log.customTaskTitle || '');
    setEditStatus(log.status || 'WORKING');
    setEditDescription(log.description || '');
    setEditProgress(log.progress ?? (log.status === 'COMPLETED' ? 100 : 50));
    setEditRestartReason(log.restartReason || '');
    setEditError('');
  };

  // Open Restart Reason Modal
  const openRestartModal = (log: any) => {
    setRestartingLog(log);
    setRestartReason('');
    setRestartReasonError('');
  };

  // Handle Confirm Restart with Reason
  const handleConfirmRestart = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = restartReason.trim();
    if (!cleanReason) {
      setRestartReasonError('Please provide a reason explaining why this task is being restarted.');
      return;
    }
    if (!restartingLog || isRestarting) return;
    setIsRestarting(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const taskTitle = restartingLog.taskId?.title || restartingLog.customTaskTitle || 'Task';
      const updatedDescription = restartingLog.description 
        ? `[Restarted: ${cleanReason}] - ${restartingLog.description}` 
        : `[Restarted: ${cleanReason}]`;

      await axios.put(
        `${API_URL}/work-logs/${restartingLog._id}`,
        {
          status: 'WORKING',
          progress: 50,
          restartReason: cleanReason,
          description: updatedDescription,
          customTaskTitle: taskTitle,
        },
        config
      );

      // Update local table
      setWorkLogs(prev =>
        prev.map(item =>
          item._id === restartingLog._id
            ? {
                ...item,
                status: 'WORKING',
                progress: 50,
                restartReason: cleanReason,
                description: updatedDescription,
              }
            : item
        )
      );

      setToast({
        type: 'success',
        text: `"${taskTitle}" restarted! Reason: "${cleanReason}". It is now active on your Dashboard.`,
        actionLabel: 'Go to Dashboard',
        actionHref: '/employee/dashboard',
      });
      setTimeout(() => setToast(null), 6000);
      setRestartingLog(null);
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        text: err.response?.data?.message || 'Failed to restart task. Please try again.',
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsRestarting(false);
    }
  };

  // Submit Edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || isSaving) return;

    // If task was COMPLETED and is now being moved to an active status, require a reason!
    const isReactivating = editingLog.status === 'COMPLETED' && editStatus !== 'COMPLETED';
    const cleanRestartReason = editRestartReason.trim();

    if (isReactivating && !cleanRestartReason) {
      setEditError('Please provide a reason for reactivating/restarting this completed task.');
      return;
    }

    setIsSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      let updatedDesc = editDescription;
      if (isReactivating && cleanRestartReason && !editDescription.includes(cleanRestartReason)) {
        updatedDesc = `[Restarted: ${cleanRestartReason}] - ${editDescription}`;
      }

      const payload: any = {
        customTaskTitle: editTitle.trim(),
        status: editStatus,
        description: updatedDesc,
        progress: Number(editProgress),
      };

      if (isReactivating && cleanRestartReason) {
        payload.restartReason = cleanRestartReason;
      }

      await axios.put(`${API_URL}/work-logs/${editingLog._id}`, payload, config);

      // Update local table
      setWorkLogs(prev =>
        prev.map(item =>
          item._id === editingLog._id
            ? {
                ...item,
                customTaskTitle: editTitle.trim(),
                status: editStatus,
                description: updatedDesc,
                progress: Number(editProgress),
                restartReason: isReactivating ? cleanRestartReason : item.restartReason,
                taskId: item.taskId
                  ? { ...item.taskId, title: editTitle.trim(), status: editStatus }
                  : item.taskId,
              }
            : item
        )
      );

      setToast({
        type: 'success',
        text: isReactivating
          ? `Work updated! "${editTitle}" has been restarted and is now active on your Dashboard.`
          : `Work record for "${editTitle}" updated successfully.`,
        actionLabel: isReactivating ? 'View Dashboard' : undefined,
        actionHref: isReactivating ? '/employee/dashboard' : undefined,
      });
      setTimeout(() => setToast(null), 6000);
      setEditingLog(null);
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update work log. Please try again.',
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl shadow-md border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-3">
            {toast.type === 'success' ? (
              <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.text}</span>
          </div>
          <div className="flex items-center space-x-3">
            {toast.actionLabel && toast.actionHref && (
              <button
                onClick={() => navigate(toast.actionHref!)}
                className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {toast.actionLabel}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Work History</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            View, edit, or restart any completed task to resume work on your dashboard
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <select 
            className="border border-gray-300 rounded-lg text-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
          </select>
          <button className="flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading history...</td></tr>
              ) : workLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                    <Calendar className="h-12 w-12 text-gray-300 mb-3" />
                    <p>No work history recorded for this period.</p>
                  </td>
                </tr>
              ) : (
                workLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(log.startTime || log.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">
                        {log.taskId?.title || log.customTaskTitle || '-'}
                      </div>
                      {log.restartReason && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md max-w-fit">
                          <span>🔄 Restart Reason: {log.restartReason}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <p className="line-clamp-2">{log.description || 'No description provided.'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {log.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => openRestartModal(log)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            title="Restart this completed task & resume work"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            Restart
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(log)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit work record & status"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-white px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="text-xs sm:text-sm text-gray-500">
              Showing page <span className="font-semibold text-gray-800">{page}</span>
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Restart Reason Modal (Opened when clicking Restart) */}
      {restartingLog && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="restart-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900/60 transition-opacity backdrop-blur-xs"
              onClick={() => !isRestarting && setRestartingLog(null)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-100 p-6">
              <form onSubmit={handleConfirmRestart}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex-shrink-0">
                    <RotateCcw className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900" id="restart-modal-title">
                      Restart Completed Task
                    </h3>
                    <p className="text-xs text-gray-500">
                      Specify the reason for reopening this task
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-4">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Task Name</span>
                  <span className="text-sm font-bold text-gray-800">
                    {restartingLog.taskId?.title || restartingLog.customTaskTitle || 'Task'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                      Reason for Restart <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      autoFocus
                      rows={3}
                      placeholder="e.g. Additional changes needed in UI, Bug reported by client, Need to update calculations..."
                      className="w-full border border-gray-300 rounded-xl shadow-2xs py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-gray-800"
                      value={restartReason}
                      onChange={(e) => {
                        setRestartReason(e.target.value);
                        if (restartReasonError) setRestartReasonError('');
                      }}
                    />
                    {restartReasonError && (
                      <p className="mt-1 text-xs font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {restartReasonError}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start space-x-2">
                    <Activity className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      After confirming, status will become <strong>WORKING</strong> and the task will instantly reappear on your <strong>Employee Dashboard</strong>.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-row-reverse gap-2">
                  <button
                    type="submit"
                    disabled={isRestarting || !restartReason.trim()}
                    className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent shadow-xs px-4 py-2 bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    {isRestarting ? 'Restarting...' : 'Confirm & Restart Task'}
                  </button>
                  <button
                    type="button"
                    disabled={isRestarting}
                    onClick={() => setRestartingLog(null)}
                    className="w-full sm:w-auto inline-flex justify-center rounded-xl border border-gray-200 shadow-xs px-4 py-2 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Modal */}
      {editingLog && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="edit-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900/60 transition-opacity backdrop-blur-xs"
              onClick={() => setEditingLog(null)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-100">
              <form onSubmit={handleSaveEdit}>
                <div className="bg-white px-5 pt-6 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Edit2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900" id="edit-modal-title">
                          Edit Work History
                        </h3>
                        <p className="text-xs text-gray-500">
                          Update task details or change status to resume work
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLog(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                        Task Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter task name"
                        className="w-full border border-gray-300 rounded-xl shadow-2xs py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-800"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                        Work Status
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-xl shadow-2xs py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium text-gray-800"
                        value={editStatus}
                        onChange={(e) => {
                          setEditStatus(e.target.value);
                          if (editError) setEditError('');
                        }}
                      >
                        <option value="WORKING">⚡ Working (In Progress)</option>
                        <option value="NOT_STARTED">⏳ Not Started</option>
                        <option value="IN_REVIEW">🔍 In Review</option>
                        <option value="ON_HOLD">⏸️ On Hold</option>
                        <option value="PENDING">🕒 Pending</option>
                        <option value="COMPLETED">✅ Completed</option>
                      </select>
                    </div>

                    {/* If reactivating a completed task, require restart reason */}
                    {editStatus !== 'COMPLETED' && editingLog.status === 'COMPLETED' && (
                      <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                        <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                          <RotateCcw className="h-4 w-4 text-amber-600" />
                          <span>Task is being reactivated — Reason Required</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                            Why are you restarting this task? <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Changes required in layout, new requirements, bug fix"
                            className="w-full bg-white border border-amber-300 rounded-lg py-1.5 px-3 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                            value={editRestartReason}
                            onChange={(e) => {
                              setEditRestartReason(e.target.value);
                              if (editError) setEditError('');
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-amber-700">
                          Reactivating will move this task to <strong>Active Tasks</strong> on your Employee Dashboard.
                        </p>
                      </div>
                    )}

                    {editError && (
                      <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {editError}
                      </p>
                    )}

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                        Work Description
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="What are you working on / changing?"
                        className="w-full border border-gray-300 rounded-xl shadow-2xs py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-800"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/80 px-5 py-3.5 sm:px-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingLog(null)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-xs font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <div className="w-full sm:w-auto flex items-center space-x-2">
                    {editingLog.status === 'COMPLETED' && editStatus === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => {
                          const current = editingLog;
                          setEditingLog(null);
                          openRestartModal(current);
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 border border-emerald-200 text-xs font-bold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restart Task
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2 border border-transparent text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkHistory;
