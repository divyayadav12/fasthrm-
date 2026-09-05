import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Filter, FileText } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Reports = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [productivityData, setProductivityData] = useState<any[]>([]);
  const [projectData, setProjectData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user?.token}` } };
        
        // Fetch Productivity
        const prodRes = await axios.get(`${API_URL}/reports/productivity`, config);
        // Format for recharts if needed (backend currently returns activeProjects, etc.)
        // We'll mock a bar chart data structure based on expected employee output
        const formattedProdData = [
          { name: 'John Doe', completedTasks: 12, workingHours: 40 },
          { name: 'Jane Smith', completedTasks: 15, workingHours: 38 },
          { name: 'Mike Ross', completedTasks: 8, workingHours: 42 },
        ];
        setProductivityData(formattedProdData);

        // Fetch Project Progress
        const projRes = await axios.get(`${API_URL}/reports/project?projectId=all`, config);
        const formattedProjData = [
          { name: 'Not Started', value: 20 },
          { name: 'Working', value: 45 },
          { name: 'In Review', value: 15 },
          { name: 'Completed', value: 20 },
        ];
        setProjectData(formattedProjData);

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch reports', error);
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [user]);

  const handleExportCSV = () => {
    alert("Exporting CSV data...");
    // Implementation for CSV export
  };

  const handleExportPDF = () => {
    alert("Exporting PDF report...");
    // Implementation for PDF export
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
        <div className="flex space-x-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Productivity Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Employee Productivity</h2>
            <button className="text-gray-400 hover:text-gray-600"><Filter className="h-4 w-4" /></button>
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading chart...</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="completedTasks" name="Completed Tasks" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="workingHours" name="Hours Logged" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Project Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Overall Task Status</h2>
            <button className="text-gray-400 hover:text-gray-600"><Filter className="h-4 w-4" /></button>
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">Loading chart...</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {projectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
