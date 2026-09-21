import { Server } from 'socket.io'

let io = null

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for dev/frontend connection
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    // Client registers their session by emitting user info
    socket.on('register', ({ userId, role }) => {
      if (userId) {
        // Join targeted room by userId
        socket.join(userId.toString())
        console.log(`[Socket.io] User ${userId} (${role}) joined room: ${userId}`)
      }

      // If user is an admin, join the shared 'admins' room for escalation alerts
      if (role === 'admin') {
        socket.join('admins')
        console.log(`[Socket.io] Admin ${userId} joined room: admins`)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!')
  }
  return io
}
