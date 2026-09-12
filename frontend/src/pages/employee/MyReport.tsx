import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Clock, BarChart2, Calendar, AlertCircle, Search } from 'lucide-react';
import axios from 'axios';
import { getTaskLiveMinutes, formatDuration } from '../../utils/timeFormat';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const getStatusStyle = (status: string) => {
  const map: Record<string, string> = {
    WORKING: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
    IN_REVIEW: 'bg-purple-100 text-purple-700 border-purple-200',
    ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
    NOT_STARTED: 'bg-gray-100 text-gray-600 border-gray-200',
    BLOCKED: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border-gray-200';
};

type FilterType = 'all' | 'today' | 'week' | 'month';

interface TaskReport {
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

interface Summary {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  pendingTasks: number;
  totalMinutes: number;
}

const MyReport: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [tasks, setTasks] = useState<TaskReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchReport();
  }, [user, filter]);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      setError('');
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      let url = `${API_URL}/reports/my-tasks`;
      const params: string[] = [];
      if (filter === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        params.push(`dateFrom=${d.toISOString()}`);
      } else if (filter === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        params.push(`dateFrom=${d.toISOString()}`);
      } else if (filter === 'month') {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
        params.push(`dateFrom=${d.toISOString()}`);
      }
      if (params.length) url += '?' + params.join('&');
      const res = await axios.get(url, config);
      setTasks(res.data.tasks || []);
      setSummary(res.data.summary || null);
    } catch {
      setError('Could not load your report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const maxMinutes = Math.max(...tasks.map((t) => t.totalMinutes), 1);
  const filterLabels: Record<FilterType, string> = {
    all: 'All Time',
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-600" />
            My Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Task-wise time you spent — your own data only</p>
        </div>
        <div className="inline-flex p-1 bg-gray-100 rounded-xl">
          {(Object.keys(filterLabels) as FilterType[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === key ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {filterLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Task Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Task Time Breakdown</h2>
            <span className="text-xs text-gray-400 font-medium">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 w-full"
              />
            </div>
            
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-gray-200 rounded-lg text-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 w-full sm:w-auto"
              title="Filter by exact date"
            />

            <select
              className="border border-gray-200 rounded-lg text-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 w-full sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="WORKING">Working</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Task Name</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Time Spent</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-48">Time Bar</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Activity</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                    Loading your report...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Calendar className="h-10 w-10 opacity-50" />
                      <p>No tasks found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks
                  .filter((t) => {
                    const title = (t.title || '').toLowerCase();
                    const desc = (t.description || '').toLowerCase();
                    const query = searchQuery.toLowerCase();
                    const matchesSearch = title.includes(query) || desc.includes(query);
                    
                    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
                    
                    let matchesDate = true;
                    if (dateFilter && t.lastActivity) {
                      const logDateStr = new Date(t.lastActivity).toISOString().split('T')[0];
                      matchesDate = logDateStr === dateFilter;
                    }
                    
                    return matchesSearch && matchesStatus && matchesDate;
                  })
                  .map((task) => {
                  const barWidth = maxMinutes > 0 ? Math.round((task.totalMinutes / maxMinutes) * 100) : 0;
                  const isLive = task.status === 'WORKING';
                  return (
                    <tr key={task._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900 max-w-xs truncate">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{task.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(task.status)}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isLive ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/80 rounded-lg text-xs font-bold text-blue-700">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
                            {formatDuration(task.totalMinutes)}
                            <span className="text-[10px] text-blue-500 uppercase">(Live)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200/70 px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {formatDuration(task.totalMinutes)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              isLive ? 'bg-blue-500' : task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-400'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">{formatDuration(task.totalMinutes)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-600 font-medium">
                          {task.lastActivity
                            ? new Date(task.lastActivity).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {task.lastActivity
                            ? new Date(task.lastActivity).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${task.progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 font-medium">{task.progress}%</span>
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
    </div>
  );
};

export default MyReport;
