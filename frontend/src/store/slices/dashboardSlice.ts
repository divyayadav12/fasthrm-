import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

interface DashboardStats {
  activeProjects: number;
  completedTasksToday: number;
  currentlyWorking: number;
}

interface DashboardState {
  stats: DashboardStats | null;
  liveActivity: any[]; // We'll store recent work logs here
  isLoading: boolean;
  isError: boolean;
  message: string;
}

const initialState: DashboardState = {
  stats: null,
  liveActivity: [],
  isLoading: false,
  isError: false,
  message: '',
};

export const fetchDashboardStats = createAsyncThunk('dashboard/fetchStats', async (_, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    const response = await axios.get(`${API_URL}/reports/productivity`, config);
    return response.data;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

// We fetch initial recent worklogs to populate live activity
export const fetchRecentActivity = createAsyncThunk('dashboard/fetchActivity', async (_, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    // Fetch recent worklogs to populate live activity and pagination
    const response = await axios.get(`${API_URL}/work-logs?limit=500`, config);
    return response.data.workLogs;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Action to handle incoming socket events
    addLiveActivity: (state, action: PayloadAction<any>) => {
      // Add new log to the beginning, keep only latest 50
      state.liveActivity.unshift(action.payload);
      if (state.liveActivity.length > 50) {
        state.liveActivity.pop();
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(fetchRecentActivity.fulfilled, (state, action) => {
        state.liveActivity = action.payload;
      });
  },
});

export const { addLiveActivity } = dashboardSlice.actions;
export default dashboardSlice.reducer;
