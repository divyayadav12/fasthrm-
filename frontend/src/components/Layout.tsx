import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { logout } from '../store/slices/authSlice';
import { fetchNotifications, markAllAsRead } from '../store/slices/notificationSlice';
import { socket } from '../utils/socket';
import { LogOut, Activity, Users, Briefcase, FileText, Settings, Menu, Bell, CheckSquare, ChevronDown, X, BarChart2, Calendar } from 'lucide-react';

const Layout = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { notifications, unreadCount } = useSelector((state: RootState) => state.notifications);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'Connecting' | 'Connected' | 'Reconnecting' | 'Offline'>('Connecting');

  const location = useLocation();

  // Close mobile sidebar on route navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      dispatch(fetchNotifications());
      
      if (!socket.connected) {
        socket.connect();
      }

      const onConnect = () => setSocketStatus('Connected');
      const onDisconnect = () => setSocketStatus('Offline');
      const onReconnect = () => setSocketStatus('Reconnecting');
      const onAdminNotification = () => {
        dispatch(fetchNotifications());
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('admin_notification', onAdminNotification);
      socket.io.on('reconnect_attempt', onReconnect);

      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('admin_notification', onAdminNotification);
        socket.io.off('reconnect_attempt', onReconnect);
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

  const renderNavLinks = () => (
    <>
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
          <Link to={`${prefix}/tasks`} className={getLinkClass(`${prefix}/tasks`)}>
            <CheckSquare className="h-5 w-5 mr-3" />
            All Tasks
          </Link>
          <Link to={`${prefix}/leaves`} className={getLinkClass(`${prefix}/leaves`)}>
            <Calendar className="h-5 w-5 mr-3" />
            Leave Management
          </Link>
        </>
      )}

      {!isAdmin && (
        <>
          <Link to={`${prefix}/history`} className={getLinkClass(`${prefix}/history`)}>
            <FileText className="h-5 w-5 mr-3" />
            My History
          </Link>
          <Link to={`${prefix}/my-report`} className={getLinkClass(`${prefix}/my-report`)}>
            <BarChart2 className="h-5 w-5 mr-3" />
            My Report
          </Link>
          <Link to={`${prefix}/leaves`} className={getLinkClass(`${prefix}/leaves`)}>
            <Calendar className="h-5 w-5 mr-3" />
            My Leaves
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 md:hidden transition-opacity duration-300"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Slide-out Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center justify-between px-5 border-b border-gray-100 bg-white">
          <img src="/logo.png" alt="FAST Logo" className="h-12 max-w-full w-auto object-contain" />
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            title="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-600 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-gray-100 flex-col shadow-xs flex-shrink-0">
        <div className="h-20 flex items-center justify-center px-4 border-b border-gray-100 bg-white">
          <img src="/logo.png" alt="FAST Logo" className="h-14 max-w-full w-auto object-contain" />
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-600 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 md:px-8 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 md:hidden p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              title="Open Navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="md:hidden flex items-center">
              <img src="/logo.png" alt="FAST" className="h-8 w-auto object-contain" />
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 relative">
            <div className={`hidden sm:flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              socketStatus === 'Connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
              socketStatus === 'Connecting' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
              'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {socketStatus === 'Connected' && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
              )}
              {socketStatus}
            </div>

            <button 
              className="text-gray-400 hover:text-gray-600 relative p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute 0.5 top-0.5 right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-xs rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => { dispatch(markAllAsRead()); }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications && notifications.length > 0 ? (
                    notifications.slice(0, 6).map((item) => (
                      <div
                        key={item._id}
                        className={`p-3.5 text-xs transition-colors hover:bg-gray-50/80 ${
                          !item.isRead ? 'bg-indigo-50/30 font-medium' : 'text-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-semibold text-xs ${item.type === 'WARNING' ? 'text-amber-700' : item.type === 'SUCCESS' ? 'text-emerald-700' : 'text-gray-900'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-600 leading-relaxed break-words select-text">
                          {item.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-gray-400">
                      No notifications yet
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center cursor-pointer pl-1 sm:pl-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700 hidden sm:inline-block truncate max-w-[120px]">{user?.name || 'User'}</span>
              <ChevronDown className="h-4 w-4 ml-1 text-gray-400 hidden sm:inline-block" />
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
