import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchTasks, deleteTask } from '../../store/slices/taskSlice';
import { Clock, Briefcase, Activity, CheckCircle, Edit2, Trash2, RotateCcw, AlertCircle, ExternalLink } from 'lucide-react';
import { socket } from '../../utils/socket';
import { formatDuration, getTaskLiveMinutes } from '../../utils/timeFormat';
import axios from 'axios';
import { TaskHistoryDrawer } from '../../components/TaskHistoryDrawer';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const EmployeeDashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { tasks, isLoading } = useSelector((state: RootState) => state.tasks);
  
  const [taskTab, setTaskTab] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [status, setStatus] = useState('WORKING');
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null); // track which task is being edited
  const [editRestartReason, setEditRestartReason] = useState('');
  const [modalError, setModalError] = useState('');

  // Restart Task Modal state
  const [restartingTask, setRestartingTask] = useState<any | null>(null);
  const [restartReason, setRestartReason] = useState('');
  const [restartReasonError, setRestartReasonError] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);

  // Delete task modal state
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Task detail drawer state (same as admin Tasks page)
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<any>(null);

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteTask(taskToDelete._id)).unwrap();
      setTaskToDelete(null);
      if (showUpdateModal && editingTask?._id === taskToDelete._id) {
        setShowUpdateModal(false);
        setEditingTask(null);
      }
      if (user) {
        dispatch(fetchTasks({ assignedTo: user._id }));
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Could not delete task. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (user) {
      dispatch(fetchTasks({ assignedTo: user._id }));
    }

    if (!socket.connected) socket.connect();
    const onWorkLogUpdated = () => {
      if (user) {
        dispatch(fetchTasks({ assignedTo: user._id }));
      }
    };

    socket.on('worklog_updated', onWorkLogUpdated);

    return () => {
      socket.off('worklog_updated', onWorkLogUpdated);
    };
  }, [dispatch, user]);

  // Open modal for new task log
  const openNewModal = () => {
    setEditingTask(null);
    setCustomTaskTitle('');
    setStatus('WORKING');
    setDescription('');
    setEditRestartReason('');
    setModalError('');
    setShowUpdateModal(true);
  };

  // Open modal pre-filled with existing task
  const openEditModal = (task: any) => {
    setEditingTask(task);
    setCustomTaskTitle(task.title);
    setStatus(task.status);
    setDescription(task.description || '');
    setEditRestartReason(task.restartReason || '');
    setModalError('');
    setShowUpdateModal(true);
  };

  // Open modal to prompt restart reason
  const openRestartModal = (task: any) => {
    setRestartingTask(task);
    setRestartReason('');
    setRestartReasonError('');
  };

  // Confirm restart with reason
  const handleConfirmRestartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = restartReason.trim();
    if (!cleanReason) {
      setRestartReasonError('Please provide a reason explaining why this task is being restarted.');
      return;
    }
    if (!restartingTask || isRestarting) return;
    setIsRestarting(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const updatedDescription = restartingTask.description 
        ? `[Restarted: ${cleanReason}] - ${restartingTask.description}` 
        : `[Restarted: ${cleanReason}]`;

      await axios.post(
        `${API_URL}/work-logs`,
        {
          customTaskTitle: restartingTask.title,
          status: 'WORKING',
          progress: 50,
          restartReason: cleanReason,
          description: updatedDescription,
          duration: 0,
          startTime: new Date(),
        },
        config
      );

      if (user) {
        dispatch(fetchTasks({ assignedTo: user._id }));
      }
      setRestartingTask(null);
      setTaskTab('ACTIVE'); // Switch to active tab so employee sees their restarted task!
    } catch (error) {
      console.error('Failed to restart task:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleUpdateWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const isReactivating = editingTask && editingTask.status === 'COMPLETED' && status !== 'COMPLETED';
    const cleanRestartReason = editRestartReason.trim();

    if (isReactivating && !cleanRestartReason) {
      setModalError('Please provide a reason for reactivating/restarting this completed task.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalDescription = description;
      if (isReactivating && cleanRestartReason && !description.includes(cleanRestartReason)) {
        finalDescription = `[Restarted: ${cleanRestartReason}] - ${description}`;
      }

      const payload: any = {
        customTaskTitle,
        status,
        progress: Number(progress),
        description: finalDescription,
        duration: Number(duration),
        startTime: new Date(Date.now() - Number(duration) * 60000),
      };

      // When editing an existing task, pass its _id for exact DB lookup.
      // Without this, backend searches by title which can create a duplicate task,
      // leaving the original task stuck in WORKING status forever.
      if (editingTask && editingTask._id) {
        payload.taskId = editingTask._id;
      }

      if (isReactivating && cleanRestartReason) {
        payload.restartReason = cleanRestartReason;
      }

      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      await axios.post(`${API_URL}/work-logs`, payload, config);
      
      setShowUpdateModal(false);
      setEditingTask(null);
      setCustomTaskTitle('');
      setDescription('');
      setDuration(0);
      dispatch(fetchTasks({ assignedTo: user?._id }));
      if (isReactivating) {
        setTaskTab('ACTIVE');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
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

  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
  const displayedTasks =
    taskTab === 'ACTIVE'
      ? pendingTasks
      : taskTab === 'COMPLETED'
      ? completedTasks
      : tasks;

  return (
    <>
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500">View and manage your daily tasks</p>
        </div>
        <button 
          onClick={openNewModal}
          className="mt-4 sm:mt-0 flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md font-bold text-sm tracking-wide cursor-pointer"
        >
          <Activity className="h-5 w-5 mr-2" />
          UPDATE WORK STATUS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => setTaskTab('ACTIVE')}
          className={`bg-white p-5 sm:p-6 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
            taskTab === 'ACTIVE' ? 'border-indigo-400 ring-2 ring-indigo-500/10 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Tasks</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{pendingTasks.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Tasks in progress</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => setTaskTab('COMPLETED')}
          className={`bg-white p-5 sm:p-6 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
            taskTab === 'COMPLETED' ? 'border-emerald-400 ring-2 ring-emerald-500/10 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{completedTasks.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Click to view & restart</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 ml-4">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => setTaskTab('ACTIVE')}
          className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Working Now</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.filter(t => t.status === 'WORKING').length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Currently in progress</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900 tracking-wide uppercase">My Tasks</h2>
          <div className="inline-flex p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setTaskTab('ACTIVE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                taskTab === 'ACTIVE'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({pendingTasks.length})
            </button>
            <button
              onClick={() => setTaskTab('COMPLETED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                taskTab === 'COMPLETED'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Completed ({completedTasks.length})
            </button>
            <button
              onClick={() => setTaskTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                taskTab === 'ALL'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({tasks.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Task Name</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Time Spent</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading tasks...</td></tr>
              ) : displayedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                    {taskTab === 'ACTIVE'
                      ? 'No active tasks. You can log a new task using UPDATE WORK STATUS, or restart a task from My Work History.'
                      : taskTab === 'COMPLETED'
                      ? 'No completed tasks found.'
                      : 'No tasks assigned.'}
                  </td>
                </tr>
              ) : (
                displayedTasks.map((task) => {
                  const liveMins = getTaskLiveMinutes(task);
                  return (
                    <tr key={task._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Task Name — clickable to open detail drawer */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTaskForDetail(task)}
                          className="group text-left"
                          title="View task details"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {task.title}
                            </span>
                            <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                          </div>
                        </button>
                        {task.restartReason && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md max-w-fit">
                            <span>🔄 Restart Reason: {task.restartReason}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 max-w-xs truncate">{task.description || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.status === 'WORKING' ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/80 rounded-lg text-xs font-bold text-blue-700">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            <span>{formatDuration(liveMins)}</span>
                            <span className="text-[10px] font-semibold text-blue-500 uppercase">(Active)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200/70 px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{formatDuration(liveMins)}</span>
                          </div>
                        )}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Details button */}
                        <button
                          onClick={() => setSelectedTaskForDetail(task)}
                          className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer"
                          title="View task history & details"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Details
                        </button>
                        {task.status === 'COMPLETED' && (
                          <button
                            onClick={() => openRestartModal(task)}
                            className="flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Restart task with reason"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            Restart
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(task)}
                          className="flex items-center px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Update
                        </button>
                        <button
                          onClick={() => setTaskToDelete(task)}
                          className="flex items-center px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-500" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Restart Reason Prompt Modal (Dashboard) */}
      {restartingTask && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="dashboard-restart-modal" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900/60 transition-opacity backdrop-blur-xs"
              onClick={() => !isRestarting && setRestartingTask(null)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-100 p-6">
              <form onSubmit={handleConfirmRestartTask}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex-shrink-0">
                    <RotateCcw className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900" id="dashboard-restart-modal">
                      Restart Completed Task
                    </h3>
                    <p className="text-xs text-gray-500">
                      Specify the reason for reopening this task
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-4">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Task Name</span>
                  <span className="text-sm font-bold text-gray-800">{restartingTask.title}</span>
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
                      placeholder="e.g. Additional modifications required, Client feedback, Bug found..."
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
                      After confirming, this task will change to <strong>WORKING</strong> and move to your <strong>Active Tasks</strong> list.
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
                    onClick={() => setRestartingTask(null)}
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

      {/* Update Work Modal */}
      {showUpdateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowUpdateModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateWork}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                      {editingTask ? <Edit2 className="h-5 w-5 text-indigo-600" /> : <Activity className="h-6 w-6 text-indigo-600" aria-hidden="true" />}
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        {editingTask ? `Update: ${editingTask.title}` : 'Update Work Status'}
                      </h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Task Name</label>
                          <input 
                            type="text"
                            required
                            placeholder="Enter task name"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={customTaskTitle}
                            onChange={(e) => setCustomTaskTitle(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <select 
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
                            value={status}
                            onChange={(e) => {
                              setStatus(e.target.value);
                              if (modalError) setModalError('');
                            }}
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="WORKING">Working</option>
                            <option value="IN_REVIEW">In Review</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="PENDING">Pending</option>
                            <option value="COMPLETED">✅ Completed</option>
                          </select>
                        </div>

                        {/* If reactivating a completed task in modal, prompt reason */}
                        {editingTask && editingTask.status === 'COMPLETED' && status !== 'COMPLETED' && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                            <label className="block text-xs font-bold text-amber-900">
                              Reason for Reactivating / Restarting <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Additional work needed, Client revisions"
                              className="w-full bg-white border border-amber-300 rounded-lg py-1.5 px-3 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                              value={editRestartReason}
                              onChange={(e) => {
                                setEditRestartReason(e.target.value);
                                if (modalError) setModalError('');
                              }}
                            />
                          </div>
                        )}

                        {modalError && (
                          <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {modalError}
                          </p>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Work Description</label>
                          <textarea 
                            required rows={3}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="What did you work on?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:items-center sm:justify-between">
                  {editingTask && (
                    <button 
                      type="button" 
                      onClick={() => setTaskToDelete(editingTask)}
                      className="inline-flex items-center px-3.5 py-2 border border-rose-200 text-xs font-semibold rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors mb-3 sm:mb-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5 text-rose-500" />
                      Delete Task
                    </button>
                  )}
                  <div className="flex flex-row-reverse gap-2 sm:ml-auto">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className={`w-full sm:w-auto inline-flex justify-center rounded-xl border border-transparent shadow-xs px-4 py-2 text-sm font-medium text-white focus:outline-none cursor-pointer ${isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {isSubmitting ? 'Saving...' : 'Log Work'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowUpdateModal(false)} 
                      className="w-full sm:w-auto inline-flex justify-center rounded-xl border border-gray-300 shadow-xs px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => !isDeleting && setTaskToDelete(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full p-6 border border-gray-100">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl bg-rose-50 sm:mx-0 sm:h-11 sm:w-11 text-rose-600 border border-rose-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-base font-bold text-gray-900">Delete Task</h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Are you sure you want to delete <strong className="text-gray-800">"{taskToDelete.title}"</strong>? This will also remove any related activity history logged for this task.
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteTask}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-xs px-4 py-2 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none sm:w-auto disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Task'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setTaskToDelete(null)}
                  className="mt-2 sm:mt-0 w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-xs px-4 py-2 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Task Detail / History Drawer — same as admin view */}
      <TaskHistoryDrawer
        isOpen={!!selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
        task={selectedTaskForDetail
          ? {
              _id: selectedTaskForDetail._id,
              taskId: selectedTaskForDetail._id,
              title: selectedTaskForDetail.title,
              status: selectedTaskForDetail.status,
              totalDuration: selectedTaskForDetail.totalDuration,
              startedAt: selectedTaskForDetail.startedAt,
              employee: user,
            }
          : null}
      />
    </>
  );
};

export default EmployeeDashboard;
