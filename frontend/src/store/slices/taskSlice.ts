import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  priority: string;
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
      });
  },
});

export default taskSlice.reducer;
