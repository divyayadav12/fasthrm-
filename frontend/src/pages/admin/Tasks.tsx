import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTasks } from '../../store/slices/taskSlice';
import { RootState, AppDispatch } from '../../store';
import { Search, Plus, Filter, CheckCircle, MoreVertical, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const TasksList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tasks, isLoading } = useSelector((state: RootState) => state.tasks);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    dispatch(fetchTasks({}));
  }, [dispatch]);

  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-100 text-blue-800',
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_REVIEW: 'bg-purple-100 text-purple-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      BLOCKED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || styles.NOT_STARTED}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900">Tasks Dashboard</h1>
        <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Tasks</p>
          <p className="text-2xl font-semibold text-gray-900">{tasks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">In Progress</p>
          <p className="text-2xl font-semibold text-blue-600">{tasks.filter(t => t.status === 'WORKING').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">In Review</p>
          <p className="text-2xl font-semibold text-purple-600">{tasks.filter(t => t.status === 'IN_REVIEW').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Completed</p>
          <p className="text-2xl font-semibold text-green-600">{tasks.filter(t => t.status === 'COMPLETED').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 sm:text-sm transition duration-150 ease-in-out"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-3">
            <select className="border border-gray-300 rounded-lg text-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <option>All Projects</option>
            </select>
            <select className="border border-gray-300 rounded-lg text-sm py-2 px-3 bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <option>All Assignees</option>
            </select>
            <button className="flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Filter className="h-4 w-4 mr-2 text-gray-500" />
              More Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status & Progress</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading tasks...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No tasks found.</td></tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                          {task.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">{task.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {task.projectId?.name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {task.assignedTo ? (
                          <>
                            <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-2">
                              {task.assignedTo.name?.charAt(0)}
                            </div>
                            <span className="text-sm text-gray-900">{task.assignedTo.name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="mb-2">
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-8">{task.progress}%</span>
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 ml-1">
                            <div className={`h-1.5 rounded-full ${task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${task.progress}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-gray-400 hover:text-gray-900">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TasksList;
