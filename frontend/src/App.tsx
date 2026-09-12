import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/admin/Dashboard';
import EmployeesList from './pages/admin/Employees';
import EmployeeDetails from './pages/admin/EmployeeDetails';
import ProjectsList from './pages/admin/Projects';
import ProjectDetails from './pages/admin/ProjectDetails';
import TasksList from './pages/admin/Tasks';
import Reports from './pages/admin/Reports';
import EmployeeDashboard from './pages/employee/Dashboard';
import WorkHistory from './pages/employee/WorkHistory';
import MyReport from './pages/employee/MyReport';
import AdminLeaves from './pages/admin/Leaves';
import MyLeaves from './pages/employee/MyLeaves';
import Layout from './components/Layout';

function App() {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
        
        <Route 
          path="/" 
          element={
            !user ? <Navigate to="/login" /> : 
            (user.role === 'ADMIN' || user.role === 'MANAGER') ? <Navigate to="/admin" /> : 
            <Navigate to="/employee" />
          } 
        />

        {/* Admin Routes */}
        <Route 
          path="/admin" 
          element={
            user && (user.role === 'ADMIN' || user.role === 'MANAGER') ? 
            <Layout /> : <Navigate to="/login" />
          } 
        >
          <Route index element={<AdminDashboard />} />
          <Route path="live" element={<Navigate to="/admin" replace />} />
          <Route path="employees" element={<EmployeesList />} />
          <Route path="employees/:id" element={<EmployeeDetails />} />

          <Route path="tasks" element={<TasksList />} />
          <Route path="reports" element={<Reports />} />
          <Route path="leaves" element={<AdminLeaves />} />
        </Route>

        {/* Employee Routes */}
        <Route 
          path="/employee" 
          element={
            user && user.role === 'EMPLOYEE' ? 
            <Layout /> : <Navigate to="/login" />
          } 
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="history" element={<WorkHistory />} />
          <Route path="my-report" element={<MyReport />} />
          <Route path="leaves" element={<MyLeaves />} />

          {/* Add more employee routes here */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
