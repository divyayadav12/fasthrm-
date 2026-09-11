import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { Calendar, Filter, Edit2, RotateCcw, X, Check, ArrowRight, Activity, AlertCircle } from 'lucide-react';
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

  // Edit / Restart Modal state
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState('WORKING');
  const [editDescription, setEditDescription] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

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

  // Open modal pre-filled
  const openEditModal = (log: any) => {
    setEditingLog(log);
    setEditTitle(log.taskId?.title || log.customTaskTitle || '');
    setEditStatus(log.status || 'WORKING');
    setEditDescription(log.description || '');
    setEditProgress(log.progress ?? (log.status === 'COMPLETED' ? 100 : 50));
  };

  // Quick Restart: 1-click set status to WORKING and update Task
  const handleQuickRestart = async (log: any) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const taskTitle = log.taskId?.title || log.customTaskTitle || 'Task';
      await axios.put(
        `${API_URL}/work-logs/${log._id}`,
        {
          status: 'WORKING',
          progress: 50,
          customTaskTitle: taskTitle,
        },
        config
      );

      // Update local state
      setWorkLogs(prev =>
        prev.map(item =>
          item._id === log._id
            ? { ...item, status: 'WORKING', progress: 50 }
            : item
        )
      );

      setToast({
        type: 'success',
        text: `"${taskTitle}" has been restarted! It is now active on your Dashboard.`,
        actionLabel: 'Go to Dashboard',
        actionHref: '/employee/dashboard',
      });
      setTimeout(() => setToast(null), 6000);
    } catch (err: any) {
      console.error(err);
      setToast({
        type: 'error',
        text: err.response?.data?.message || 'Failed to restart task. Please try again.',
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || isSaving) return;
    setIsSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const payload = {
        customTaskTitle: editTitle.trim(),
        status: editStatus,
        description: editDescription,
        progress: Number(editProgress),
      };

      await axios.put(`${API_URL}/work-logs/${editingLog._id}`, payload, config);

      // Update local table
      setWorkLogs(prev =>
        prev.map(item =>
          item._id === editingLog._id
            ? {
                ...item,
                customTaskTitle: editTitle.trim(),
                status: editStatus,
                description: editDescription,
                progress: Number(editProgress),
                taskId: item.taskId
                  ? { ...item.taskId, title: editTitle.trim(), status: editStatus }
                  : item.taskId,
              }
            : item
        )
      );

      const isNowActive = editStatus !== 'COMPLETED';
      setToast({
        type: 'success',
        text: isNowActive
          ? `Work updated! "${editTitle}" is now active and visible on your Dashboard.`
          : `Work record for "${editTitle}" updated successfully.`,
        actionLabel: isNowActive ? 'View Dashboard' : undefined,
        actionHref: isNowActive ? '/employee/dashboard' : undefined,
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
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
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
                            onClick={() => handleQuickRestart(log)}
                            disabled={isSaving}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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

      {/* Edit / Restart Work Modal */}
      {editingLog && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="edit-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900/60 transition-opacity backdrop-blur-xs"
              aria-hidden="true"
              onClick={() => setEditingLog(null)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
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
                        onChange={(e) => setEditStatus(e.target.value)}
                      >
                        <option value="WORKING">⚡ Working (In Progress)</option>
                        <option value="NOT_STARTED">⏳ Not Started</option>
                        <option value="IN_REVIEW">🔍 In Review</option>
                        <option value="ON_HOLD">⏸️ On Hold</option>
                        <option value="PENDING">🕒 Pending</option>
                        <option value="COMPLETED">✅ Completed</option>
                      </select>
                    </div>

                    {/* Status hint alert */}
                    {editStatus !== 'COMPLETED' && editingLog.status === 'COMPLETED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5">
                        <Activity className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          <strong>Reactivating task:</strong> By changing status to <strong>{editStatus}</strong>, this task will immediately appear on your <strong>Employee Dashboard</strong> so you can continue working on it.
                        </p>
                      </div>
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
                          setEditStatus('WORKING');
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
