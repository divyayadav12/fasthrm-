import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

export interface Leave {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    email: string;
    department?: string;
  } | string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  adminComment?: string;
  createdAt: string;
}

interface LeaveState {
  leaves: Leave[];
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  message: string;
}

const initialState: LeaveState = {
  leaves: [],
  isLoading: false,
  isError: false,
  isSuccess: false,
  message: '',
};

export const applyLeave = createAsyncThunk(
  'leaves/apply',
  async (leaveData: { startDate: string; endDate: string; reason: string }, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(API_URL + '/leaves/apply', leaveData, config);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchMyLeaves = createAsyncThunk(
  'leaves/fetchMy',
  async (_, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(API_URL + '/leaves/my', config);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchAllLeaves = createAsyncThunk(
  'leaves/fetchAll',
  async (_, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(API_URL + '/leaves', config);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const updateLeaveStatus = createAsyncThunk(
  'leaves/updateStatus',
  async (data: { id: string; status: string; adminComment?: string }, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.put(`${API_URL}/leaves/${data.id}/status`, data, config);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const leaveSlice = createSlice({
  name: 'leaves',
  initialState,
  reducers: {
    resetLeaveState: (state) => {
      state.isLoading = false;
      state.isError = false;
      state.isSuccess = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(applyLeave.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(applyLeave.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.leaves.unshift(action.payload);
      })
      .addCase(applyLeave.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(fetchMyLeaves.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchMyLeaves.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaves = action.payload;
      })
      .addCase(fetchMyLeaves.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(fetchAllLeaves.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllLeaves.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaves = action.payload;
      })
      .addCase(fetchAllLeaves.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(updateLeaveStatus.fulfilled, (state, action) => {
        const index = state.leaves.findIndex((l) => l._id === action.payload._id);
        if (index !== -1) {
          state.leaves[index] = action.payload;
        }
      });
  },
});

export const { resetLeaveState } = leaveSlice.actions;
export default leaveSlice.reducer;
