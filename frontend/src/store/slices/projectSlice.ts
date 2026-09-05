import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

export interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  projectManager?: any;
  members?: any[];
}

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  message: string;
}

const initialState: ProjectState = {
  projects: [],
  isLoading: false,
  isError: false,
  message: '',
};

export const fetchProjects = createAsyncThunk('projects/fetchAll', async (_, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as RootState;
    const token = state.auth.user?.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    const response = await axios.get(`${API_URL}/projects`, config);
    return response.data;
  } catch (error: any) {
    const message = (error.response && error.response.data && error.response.data.message) || error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      });
  },
});

export default projectSlice.reducer;
