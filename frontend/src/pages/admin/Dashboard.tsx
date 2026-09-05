import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchDashboardStats, fetchRecentActivity, addLiveActivity } from '../../store/slices/dashboardSlice';
import { socket } from '../../utils/socket';
import { Briefcase, CheckCircle, Users, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { stats, liveActivity, isLoading } = useSelector((state: RootState) => state.dashboard);
  const [socketStatus, setSocketStatus] = useState<'Connecting' | 'Connected' | 'Reconnecting' | 'Offline'>('Connecting');

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchRecentActivity());

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => setSocketStatus('Connected');
    const onDisconnect = () => setSocketStatus('Offline');
    const onWorkLogUpdated = (data: any) => {
      dispatch(addLiveActivity(data));
      dispatch(fetchDashboardStats());
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('worklog_updated', onWorkLogUpdated);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('worklog_updated', onWorkLogUpdated);
    };
  }, [dispatch]);

  const getStatusBadge = (status: string) => {
    const styles: any = {
      WORKING: 'bg-blue-100 text-blue-800',
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_REVIEW: 'bg-purple-100 text-purple-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      BLOCKED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">Live Status:</span>
          <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            socketStatus === 'Connected' ? 'bg-green-100 text-green-800' : 
            socketStatus === 'Connecting' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }`}>
            {socketStatus === 'Connected' && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              </>
            )}
            {socketStatus}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Projects</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.activeProjects || 0}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Completed Today</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.completedTasksToday || 0}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
          <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Currently Working</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.currentlyWorking || 0}</p>
          </div>
        </div>
      </div>

      {/* Live Team Status Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">LIVE TEAM STATUS</h2>
          <span className="flex items-center text-sm font-medium text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
            Auto-updating
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liveActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No recent activity to display.
                  </td>
                </tr>
              ) : (
                liveActivity.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                          {log.employeeId?.name?.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{log.employeeId?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      {log.taskId?.title || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{log.progress}%</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${log.progress}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleTimeString()}
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

export default AdminDashboard;
