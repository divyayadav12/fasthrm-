import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://fasthrm-1l03.onrender.com';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
});
