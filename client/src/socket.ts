import { io, type Socket } from 'socket.io-client'
import { getToken } from './api'

// We keep ONE socket connection for the whole app.
let socket: Socket | null = null

// Connect to the SAME origin that served the app (no URL argument). In dev,
// Vite's proxy forwards /socket.io to the backend; in production, nginx does.
// So there's no hard-coded server address and no CORS to worry about.
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ auth: { token: getToken() } })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
