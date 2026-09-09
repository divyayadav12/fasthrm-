import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { logout } from '../store/slices/authSlice';
import { fetchNotifications, markAllAsRead } from '../store/slices/notificationSlice';
import { socket } from '../utils/socket';
import { LogOut, Activity, Users, Briefcase, FileText, Settings, Menu, Bell, CheckSquare, ChevronDown } from 'lucide-react';

const Layout = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { unreadCount } = useSelector((state: RootState) => state.notifications);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'Connecting' | 'Connected' | 'Reconnecting' | 'Offline'>('Connecting');

  useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
      
      if (!socket.connected) {
        socket.connect();
      }

      const onConnect = () => setSocketStatus('Connected');
      const onDisconnect = () => setSocketStatus('Offline');
      const onReconnect = () => setSocketStatus('Reconnecting');

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.io.on('reconnect_attempt', onReconnect);

      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.io.off('reconnect_attempt', onReconnect);
        // We don't fully disconnect so Dashboard can use it, but we could if Layout unmounts
      };
    } else {
      socket.disconnect();
    }
  }, [dispatch, user]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const prefix = isAdmin ? '/admin' : '/employee';
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === prefix) {
      return location.pathname === prefix || location.pathname === `${prefix}/`;
    }
    return location.pathname.startsWith(path);
  };

  const getLinkClass = (path: string) => {
    return `flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-indigo-600 bg-indigo-50 font-semibold'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-xs">
        <div className="h-20 flex items-center justify-center px-4 border-b border-gray-100 bg-white">
          <img src="/logo.png" alt="FAST Logo" className="h-14 max-w-full w-auto object-contain" />
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link to={prefix} className={getLinkClass(prefix)}>
            <Activity className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          
          {isAdmin && (
            <>
              <Link to={`${prefix}/employees`} className={getLinkClass(`${prefix}/employees`)}>
                <Users className="h-5 w-5 mr-3" />
                Employees
              </Link>
              <Link to={`${prefix}/reports`} className={getLinkClass(`${prefix}/reports`)}>
                <FileText className="h-5 w-5 mr-3" />
                Reports
              </Link>
            </>
          )}



          {isAdmin && (
            <Link to={`${prefix}/tasks`} className={getLinkClass(`${prefix}/tasks`)}>
              <CheckSquare className="h-5 w-5 mr-3" />
              All Tasks
            </Link>
          )}

          {!isAdmin && (
            <Link to={`${prefix}/history`} className={getLinkClass(`${prefix}/history`)}>
              <FileText className="h-5 w-5 mr-3" />
              My History
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-600 rounded-lg text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8">
          <div className="flex items-center">
            <button className="text-gray-500 hover:text-gray-700 lg:hidden">
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center space-x-4 relative">
            <div className={`hidden sm:flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              socketStatus === 'Connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
              socketStatus === 'Connecting' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
              'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {socketStatus === 'Connected' && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              )}
              {socketStatus}
            </div>

            <button 
              className="text-gray-400 hover:text-gray-600 relative p-1 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-12 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => { dispatch(markAllAsRead()); setShowNotifications(false); }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="p-4 text-center text-sm text-gray-500">
                  You have {unreadCount} unread notifications.
                  <br/>
                  <Link to={`${prefix}/notifications`} className="text-indigo-600 font-medium mt-2 inline-block">View all</Link>
                </div>
              </div>
            )}

            <div className="flex items-center cursor-pointer pl-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="ml-2.5 text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
              <ChevronDown className="h-4 w-4 ml-1.5 text-gray-400" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC] p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
