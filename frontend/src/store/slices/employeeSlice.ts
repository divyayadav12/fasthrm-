import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface Employee {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  isActive: boolean;
  createdAt: string;
}

interface EmployeeState {
  employees: Employee[];
  currentEmployee: Employee | null;
  total: number;
  page: number;
  pages: number;
  isLoading: boolean;
  isError: boolean;
  message: string;
}

const initialState: EmployeeState = {
  employees: [],
  currentEmployee: null,
  total: 0,
  page: 1,
  pages: 1,
  isLoading: false,
  isError: false,
  message: '',
};

export const fetchEmployees = createAsyncThunk('employees/fetchAll', async (params: any, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { 
      headers: { Authorization: `Bearer ${token}` },
      params
    };
    
    const response = await axios.get(`${API_URL}/employees`, config);
    return response.data;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const fetchEmployeeById = createAsyncThunk('employees/fetchById', async (id: string, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    const response = await axios.get(`${API_URL}/employees/${id}`, config);
    return response.data;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.response.data.message);
  }
});

export const employeeSlice = createSlice({
  name: 'employees',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.isLoading = false;
        state.employees = action.payload.employees;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })
      .addCase(fetchEmployeeById.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchEmployeeById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentEmployee = action.payload;
      });
  },
});

export default employeeSlice.reducer;
