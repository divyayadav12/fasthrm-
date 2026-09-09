import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import EmployeesList from './pages/admin/Employees';
import EmployeeDetails from './pages/admin/EmployeeDetails';
import ProjectsList from './pages/admin/Projects';
import ProjectDetails from './pages/admin/ProjectDetails';
import TasksList from './pages/admin/Tasks';
import Reports from './pages/admin/Reports';
import EmployeeDashboard from './pages/employee/Dashboard';
import WorkHistory from './pages/employee/WorkHistory';
import Layout from './components/Layout';

function App() {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        
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
        </Route>

        {/* Employee Routes */}
        <Route 
          path="/employee" 
          element={
            user && user.role !== 'ADMIN' && user.role !== 'MANAGER' ? 
            <Layout /> : <Navigate to="/login" />
          } 
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="history" element={<WorkHistory />} />

          {/* Add more employee routes here */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
