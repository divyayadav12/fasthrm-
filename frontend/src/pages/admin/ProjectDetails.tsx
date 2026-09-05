import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ArrowLeft, Users, CheckCircle, Clock, Calendar, MoreVertical } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user?.token}` } };
        // In a real app we'd have a specific endpoint or use Redux
        const res = await axios.get(`${API_URL}/projects`, config);
        const currentProject = res.data.find((p: any) => p._id === id);
        setProject(currentProject);

        const tasksRes = await axios.get(`${API_URL}/tasks`, { ...config, params: { projectId: id } });
        setTasks(tasksRes.data);
        
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    };
    if (id) fetchProjectData();
  }, [id, user]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading project details...</div>;
  if (!project) return <div className="p-8 text-center text-red-500">Project not found.</div>;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/admin/projects" className="p-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">
          Edit Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project Overview</h2>
            <p className="text-gray-600">{project.description}</p>
            <div className="mt-6 flex items-center space-x-6">
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Users className="h-4 w-4 mr-2" />
                {project.members?.length || 0} Members
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Project Tasks</h2>
              <button className="text-sm text-indigo-600 hover:text-indigo-900">Add Task</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assignee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tasks.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">No tasks created yet.</td></tr>
                  ) : (
                    tasks.map(task => (
                      <tr key={task._id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{task.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{task.status}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{task.assignedTo?.name || 'Unassigned'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Progress</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold text-gray-900">{progress}%</span>
              <div className={`px-2 py-1 text-xs font-semibold rounded-full ${project.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {project.status}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Tasks</span>
                <span className="font-medium">{totalTasks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Completed</span>
                <span className="font-medium text-green-600">{completedTasks}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
