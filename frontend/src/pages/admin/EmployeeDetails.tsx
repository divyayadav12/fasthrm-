import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployeeById } from '../../store/slices/employeeSlice';
import { RootState, AppDispatch } from '../../store';
import { ArrowLeft, Briefcase, Mail, Phone, Calendar, MapPin, Building, Activity, Clock, FileText } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const EmployeeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentEmployee, isLoading } = useSelector((state: RootState) => state.employees);
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(fetchEmployeeById(id));
      fetchWorkHistory(id);
    }
  }, [id, dispatch]);

  const fetchWorkHistory = async (employeeId: string) => {
    try {
      setHistoryLoading(true);
      const config = { headers: { Authorization: `Bearer ${user?.token}` } };
      const response = await axios.get(`${API_URL}/work-logs/employee/${employeeId}?limit=100`, config);
      setWorkHistory(response.data.workLogs);
      setHistoryLoading(false);
    } catch (error) {
      console.error('Failed to fetch history', error);
      setHistoryLoading(false);
    }
  };

  const tabs = ['Overview', 'Current Work', 'Work History', 'Projects', 'Activity'];

  if (isLoading || !currentEmployee) return <div className="p-8 text-center text-gray-500">Loading employee details...</div>;

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-100 text-blue-800',
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_REVIEW: 'bg-purple-100 text-purple-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      BLOCKED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles['NOT_STARTED']}`}>{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/admin/employees" className="p-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Employee Profile</h1>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-32 bg-indigo-600"></div>
        <div className="px-8 pb-8 flex flex-col md:flex-row relative">
          <div className="-mt-16 mr-6">
            <div className="h-32 w-32 bg-white p-1 rounded-full shadow-md">
              <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center text-4xl text-indigo-700 font-bold border-4 border-white">
                {currentEmployee.name.charAt(0)}
              </div>
            </div>
          </div>
          <div className="mt-4 md:mt-4 flex-1">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">{currentEmployee.name}</h2>
                <p className="text-lg text-gray-600">{currentEmployee.designation || currentEmployee.role}</p>
              </div>
              <div className="mt-4 md:mt-0 space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {currentEmployee.email}
                </div>

                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Joined {new Date(currentEmployee.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap focus:outline-none ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Summary</h3>
              <p className="text-gray-600">Information about {currentEmployee.name}'s overall productivity and role overview will be displayed here.</p>
            </div>
          )}

          {activeTab === 'Work History' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Complete Historical Work Log</h3>
                <div className="flex space-x-2">
                  <select className="border border-gray-300 rounded-md text-sm py-1 px-2">
                    <option>All Time</option>
                    <option>Last 7 Days</option>
                    <option>This Month</option>
                  </select>
                </div>
              </div>
              
              {historyLoading ? (
                <div className="py-8 text-center text-gray-500">Loading history...</div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Update</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workHistory.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No work history found.</td></tr>
                      ) : (
                        workHistory.map((log) => (
                          <tr key={log._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">{new Date(log.startTime).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="font-medium text-gray-900 truncate max-w-xs">{log.taskId?.title || log.customTaskTitle || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(log.status)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              <p className="line-clamp-2">{log.description || '-'}</p>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Current Work' && (
            <div className="py-8 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>Current active tasks mapping goes here.</p>
            </div>
          )}

          {activeTab === 'Projects' && (
            <div className="py-8 text-center text-gray-500">
              <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>Assigned projects mapping goes here.</p>
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="py-8 text-center text-gray-500">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>General activity logs mapping goes here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;
