import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchTasks, deleteTask } from '../../store/slices/taskSlice';
import { Search, Filter, CheckCircle, Clock, Trash2, History } from 'lucide-react';
import { TaskHistoryDrawer } from '../../components/TaskHistoryDrawer';
import { formatDuration, getTaskLiveMinutes } from '../../utils/timeFormat';

const TasksList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tasks, isLoading } = useSelector((state: RootState) => state.tasks);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<any>(null);

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteTask(taskToDelete._id)).unwrap();
      setTaskToDelete(null);
      dispatch(fetchTasks({}));
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Could not delete task. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    dispatch(fetchTasks({}));
  }, [dispatch]);

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

  // Get unique assignees for filter
  const uniqueAssignees = Array.from(
    new Set(tasks.map((t) => t.assignedTo?.name).filter(Boolean))
  );

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAssignee = !assigneeFilter || task.assignedTo?.name === assigneeFilter;
    const matchesStatus = !statusFilter || task.status === statusFilter;
    return matchesSearch && matchesAssignee && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Tasks</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">All recorded</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 ml-4">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">In Progress</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.filter(t => t.status === 'WORKING').length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Active right now</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">In Review</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.filter(t => t.status === 'IN_REVIEW').length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Pending feedback</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Filter className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.filter(t => t.status === 'COMPLETED').length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Successfully closed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 ml-4">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0 gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center space-x-3 gap-y-2">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Assignees</option>
              {uniqueAssignees.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl text-sm py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="WORKING">Working</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="PENDING">Pending</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="NOT_STARTED">Not Started</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Assignee</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Time Spent</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading tasks...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No tasks found.</td></tr>
              ) : (
                filteredTasks.map((task) => {
                  const liveMinutes = getTaskLiveMinutes(task);
                  return (
                    <tr key={task._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {task.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                          </div>
                          <div className="ml-3.5">
                            <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                            <div className="text-xs text-gray-400 truncate max-w-md mt-0.5">{task.description || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {task.assignedTo ? (
                            <>
                              <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs mr-2.5">
                                {task.assignedTo.name?.charAt(0).toLowerCase() || 'u'}
                              </div>
                              <span className="text-sm font-medium text-gray-800">{task.assignedTo.name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.status === 'WORKING' ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/80 rounded-lg text-xs font-bold text-blue-700">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            <span>{formatDuration(liveMinutes)}</span>
                            <span className="text-[10px] font-semibold text-blue-500 uppercase">(Active)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200/70 px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{formatDuration(liveMinutes)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedTaskForHistory({
                              _id: task._id,
                              taskId: task._id,
                              title: task.title,
                              employee: task.assignedTo,
                              status: task.status,
                              totalDuration: task.totalDuration,
                              startedAt: task.startedAt,
                            })}
                            className="flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="View task progression & time logs"
                          >
                            <History className="h-3.5 w-3.5 mr-1" />
                            History
                          </button>
                          <button
                            onClick={() => setTaskToDelete(task)}
                            className="flex items-center px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
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
                    Are you sure you want to delete <strong className="text-gray-800">"{taskToDelete.title}"</strong>? This will remove the task and all associated work activity logs permanently.
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

      {/* Task History Drawer */}
      {selectedTaskForHistory && (
        <TaskHistoryDrawer
          isOpen={!!selectedTaskForHistory}
          onClose={() => setSelectedTaskForHistory(null)}
          task={selectedTaskForHistory}
        />
      )}
    </div>
  );
};

export default TasksList;
