import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, FileText, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const STATUS_COLORS: Record<string, string> = {
  'Working': '#3B82F6',
  'Completed': '#10B981',
  'In Review': '#8B5CF6',
  'Pending': '#F59E0B',
  'On Hold': '#EAB308',
  'Not Started': '#9CA3AF',
};

const Reports = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [productivityData, setProductivityData] = useState<any[]>([]);
  const [taskStatusData, setTaskStatusData] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRealReports = async () => {
      try {
        setIsLoading(true);
        const config = { headers: { Authorization: `Bearer ${user?.token}` } };
        
        // Fetch real tasks and real employees concurrently
        const [tasksRes, employeesRes, prodRes] = await Promise.all([
          axios.get(`${API_URL}/tasks`, config).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/employees?limit=200`, config).catch(() => ({ data: { employees: [] } })),
          axios.get(`${API_URL}/reports/employee`, config).catch(() => ({ data: [] })),
        ]);

        const realTasks: any[] = Array.isArray(tasksRes.data) ? tasksRes.data : [];
        const realEmployees: any[] = employeesRes.data?.employees || [];
        const prodLogs: any[] = Array.isArray(prodRes.data) ? prodRes.data : [];

        setTasks(realTasks);
        setEmployees(realEmployees);

        // 1. Calculate Real Employee Productivity
        // Build map of employee productivity
        const employeeMap: Record<string, { name: string; completedTasks: number; totalTasks: number; hoursLogged: number }> = {};

        // Pre-populate with real registered employees (excluding ADMIN)
        realEmployees.forEach((emp) => {
          if (emp.name) {
            employeeMap[emp._id] = {
              name: emp.name.length > 15 ? emp.name.substring(0, 15) + '...' : emp.name,
              completedTasks: 0,
              totalTasks: 0,
              hoursLogged: 0,
            };
          }
        });

        // Add task counts
        realTasks.forEach((task) => {
          const empId = task.assignedTo?._id || task.assignedTo;
          if (empId && employeeMap[empId]) {
            employeeMap[empId].totalTasks += 1;
            if (task.status === 'COMPLETED') {
              employeeMap[empId].completedTasks += 1;
            }
          } else if (task.assignedTo?.name) {
            const name = task.assignedTo.name;
            if (!employeeMap[name]) {
              employeeMap[name] = {
                name: name.length > 15 ? name.substring(0, 15) + '...' : name,
                completedTasks: 0,
                totalTasks: 0,
                hoursLogged: 0,
              };
            }
            employeeMap[name].totalTasks += 1;
            if (task.status === 'COMPLETED') {
              employeeMap[name].completedTasks += 1;
            }
          }
        });

        // Add hours logged from work logs
        prodLogs.forEach((log) => {
          const empId = log._id;
          if (empId && employeeMap[empId]) {
            employeeMap[empId].hoursLogged = Math.round(((log.totalDuration || 0) / 60) * 10) / 10;
            if (log.completedLogs && employeeMap[empId].completedTasks === 0) {
              employeeMap[empId].completedTasks = log.completedLogs;
            }
          }
        });

        const formattedProdData = Object.values(employeeMap)
          .filter((e) => e.totalTasks > 0 || e.hoursLogged > 0 || e.completedTasks > 0)
          .slice(0, 10);

        // If no employee has tasks assigned yet, show all registered employees with 0
        if (formattedProdData.length === 0) {
          setProductivityData(
            Object.values(employeeMap).slice(0, 8)
          );
        } else {
          setProductivityData(formattedProdData);
        }

        // 2. Calculate Real Overall Task Status
        const statusCountMap: Record<string, number> = {
          'Working': 0,
          'Completed': 0,
          'In Review': 0,
          'Pending': 0,
          'On Hold': 0,
          'Not Started': 0,
        };

        realTasks.forEach((task) => {
          const s = (task.status || '').toUpperCase();
          if (s === 'WORKING') statusCountMap['Working'] += 1;
          else if (s === 'COMPLETED') statusCountMap['Completed'] += 1;
          else if (s === 'IN_REVIEW') statusCountMap['In Review'] += 1;
          else if (s === 'PENDING' || s === 'BLOCKED') statusCountMap['Pending'] += 1;
          else if (s === 'ON_HOLD') statusCountMap['On Hold'] += 1;
          else statusCountMap['Not Started'] += 1;
        });

        const formattedStatusData = Object.entries(statusCountMap)
          .filter(([_, value]) => value > 0)
          .map(([name, value]) => ({
            name,
            value,
            color: STATUS_COLORS[name] || '#6B7280',
          }));

        setTaskStatusData(formattedStatusData);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch real reports', error);
        setIsLoading(false);
      }
    };

    fetchRealReports();
  }, [user]);

  // Real CSV Export
  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert("No task data to export.");
      return;
    }

    const headers = ['Task Title', 'Description', 'Assignee Name', 'Assignee Email', 'Status', 'Created Date'];
    const rows = tasks.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.assignedTo?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(t.assignedTo?.email || '').replace(/"/g, '""')}"`,
      `"${t.status || ''}"`,
      `"${new Date(t.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tasks_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-sm text-gray-500">Real-time team productivity and task distribution</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            <FileText className="h-4 w-4 mr-2" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Team Members</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{employees.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Registered staff</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 ml-4">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Live Tasks</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{tasks.length}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Active system tasks</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 ml-4">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed Tasks</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">
              {tasks.filter((t) => t.status === 'COMPLETED').length}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Successfully closed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 ml-4">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real Employee Productivity Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Employee Productivity</h2>
              <p className="text-xs text-gray-500">Completed vs Assigned Tasks per Employee</p>
            </div>
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading real data...</div>
          ) : productivityData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">No employee task data logged yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityData} margin={{ top: 5, right: 30, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#4B5563', fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#F3F4F6' }} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="completedTasks" name="Completed Tasks" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalTasks" name="Total Tasks" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Real Task Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Overall Task Status</h2>
              <p className="text-xs text-gray-500">Live breakdown of all current tasks</p>
            </div>
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading chart...</div>
          ) : taskStatusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">No tasks found.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
