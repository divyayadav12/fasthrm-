import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../index';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
};

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async (_, thunkAPI) => {
  const state = thunkAPI.getState() as RootState;
  const config = { headers: { Authorization: `Bearer ${state.auth.user?.token}` } };
  const response = await axios.get(`${API_URL}/notifications`, config);
  return response.data;
});

export const markAsRead = createAsyncThunk('notifications/markRead', async (id: string, thunkAPI) => {
  const state = thunkAPI.getState() as RootState;
  const config = { headers: { Authorization: `Bearer ${state.auth.user?.token}` } };
  await axios.put(`${API_URL}/notifications/${id}/read`, {}, config);
  return id;
});

export const markAllAsRead = createAsyncThunk('notifications/markAllRead', async (_, thunkAPI) => {
  const state = thunkAPI.getState() as RootState;
  const config = { headers: { Authorization: `Bearer ${state.auth.user?.token}` } };
  await axios.put(`${API_URL}/notifications/read-all`, {}, config);
  return true;
});

export const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter((n: Notification) => !n.isRead).length;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notif = state.notifications.find(n => n._id === action.payload);
        if (notif && !notif.isRead) {
          notif.isRead = true;
          state.unreadCount -= 1;
        }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(n => n.isRead = true);
        state.unreadCount = 0;
      });
  },
});

export default notificationSlice.reducer;
