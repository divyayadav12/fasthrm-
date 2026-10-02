import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

export interface StudentInquiry {
  _id: string;
  inquiryId: string;
  studentName: string;
  mobileNumber: string;
  alternateNumber?: string;
  email?: string;
  callType: 'Enquiry' | 'Tech Issue' | 'Dispatch Related' | 'Purchases' | 'Others';
  subject?: string;
  details?: string;
  remark?: string;
  status: 'Solved' | 'Follow Up' | 'Purchases' | 'Pending' | 'Others';
  forwardedBy?: string;
  forwardedTo?: string;
  addedBy: {
    _id: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
  } | string;
  addedByName: string;
  addedByEmail?: string;
  addedByDepartment?: string;
  previousInquiryId?: string;
  previousInquiryRef?: any;
  followUpDate?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryStats {
  total: number;
  solved: number;
  followUp: number;
  purchases: number;
  pending: number;
  others: number;
  byCallType: Record<string, number>;
}

interface StudentInquiryState {
  inquiries: StudentInquiry[];
  stats: InquiryStats | null;
  total: number;
  totalPages: number;
  currentPage: number;
  selectedInquiry: StudentInquiry | null;
  relatedInquiries: StudentInquiry[];
  lookupResult: {
    found: boolean;
    count: number;
    studentName: string;
    latestInquiry: StudentInquiry | null;
    inquiries: StudentInquiry[];
  } | null;
  isLookupLoading: boolean;
  isLoading: boolean;
  isError: boolean;
  message: string;
}

const initialState: StudentInquiryState = {
  inquiries: [],
  stats: null,
  total: 0,
  totalPages: 1,
  currentPage: 1,
  selectedInquiry: null,
  relatedInquiries: [],
  lookupResult: null,
  isLookupLoading: false,
  isLoading: false,
  isError: false,
  message: '',
};

export const fetchStudentInquiries = createAsyncThunk(
  'studentInquiries/fetchAll',
  async (params: any = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params,
      };

      const response = await axios.get(`${API_URL}/student-inquiries`, config);
      return response.data;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const lookupStudentPhone = createAsyncThunk(
  'studentInquiries/lookupPhone',
  async (phone: string, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params: { phone },
      };

      const response = await axios.get(`${API_URL}/student-inquiries/lookup`, config);
      return response.data;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const createStudentInquiry = createAsyncThunk(
  'studentInquiries/create',
  async (inquiryData: any, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(`${API_URL}/student-inquiries`, inquiryData, config);
      return response.data;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const updateStudentInquiry = createAsyncThunk(
  'studentInquiries/update',
  async ({ id, data }: { id: string; data: any }, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.put(`${API_URL}/student-inquiries/${id}`, data, config);
      return response.data;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const fetchStudentInquiryDetails = createAsyncThunk(
  'studentInquiries/fetchDetails',
  async (id: string, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.get(`${API_URL}/student-inquiries/${id}`, config);
      return response.data;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const deleteStudentInquiry = createAsyncThunk(
  'studentInquiries/delete',
  async (id: string, thunkAPI) => {
    try {
      const state = thunkAPI.getState() as RootState;
      const token = state.auth.user?.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      await axios.delete(`${API_URL}/student-inquiries/${id}`, config);
      return id;
    } catch (error: any) {
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const studentInquirySlice = createSlice({
  name: 'studentInquiries',
  initialState,
  reducers: {
    clearLookupResult: (state) => {
      state.lookupResult = null;
    },
    clearSelectedInquiry: (state) => {
      state.selectedInquiry = null;
      state.relatedInquiries = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Inquiries
      .addCase(fetchStudentInquiries.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      .addCase(fetchStudentInquiries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.inquiries = action.payload.inquiries || [];
        state.total = action.payload.pagination?.total || 0;
        state.totalPages = action.payload.pagination?.totalPages || 1;
        state.currentPage = action.payload.pagination?.page || 1;
        state.stats = action.payload.stats || null;
      })
      .addCase(fetchStudentInquiries.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload as string;
      })

      // Lookup Phone
      .addCase(lookupStudentPhone.pending, (state) => {
        state.isLookupLoading = true;
      })
      .addCase(lookupStudentPhone.fulfilled, (state, action) => {
        state.isLookupLoading = false;
        state.lookupResult = action.payload;
      })
      .addCase(lookupStudentPhone.rejected, (state) => {
        state.isLookupLoading = false;
      })

      // Create Inquiry
      .addCase(createStudentInquiry.fulfilled, (state, action) => {
        if (action.payload.inquiry) {
          state.inquiries.unshift(action.payload.inquiry);
          state.total += 1;
        }
      })

      // Update Inquiry
      .addCase(updateStudentInquiry.fulfilled, (state, action) => {
        if (action.payload.inquiry) {
          const updated = action.payload.inquiry;
          const index = state.inquiries.findIndex((i) => i._id === updated._id);
          if (index !== -1) {
            state.inquiries[index] = updated;
          }
          if (state.selectedInquiry && state.selectedInquiry._id === updated._id) {
            state.selectedInquiry = updated;
          }
        }
      })

      // Fetch Details
      .addCase(fetchStudentInquiryDetails.fulfilled, (state, action) => {
        state.selectedInquiry = action.payload.inquiry || null;
        state.relatedInquiries = action.payload.relatedInquiries || [];
      })

      // Delete Inquiry
      .addCase(deleteStudentInquiry.fulfilled, (state, action) => {
        state.inquiries = state.inquiries.filter((i) => i._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const { clearLookupResult, clearSelectedInquiry } = studentInquirySlice.actions;
export default studentInquirySlice.reducer;
