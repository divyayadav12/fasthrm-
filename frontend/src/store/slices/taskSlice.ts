import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

export interface Task {
  _id: string;
  title: string;
  description: string;
  restartReason?: string;
  status: string;
  progress: number;
  priority: string;
  totalDuration?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId?: any;
  assignedTo?: any;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  message: string;
}

const initialState: TaskState = {
  tasks: [],
  isLoading: false,
  isError: false,
  message: '',
};

export const fetchTasks = createAsyncThunk('tasks/fetchAll', async (params: any = {}, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { 
      headers: { Authorization: `Bearer ${token}` },
      params
    };
    
    const response = await axios.get(`${API_URL}/tasks`, config);
    return response.data;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const deleteTask = createAsyncThunk('tasks/delete', async (taskId: string, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    await axios.delete(`${API_URL}/tasks/${taskId}`, config);
    return taskId;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter((t) => t._id !== action.payload);
      });
  },
});

export default taskSlice.reducer;
