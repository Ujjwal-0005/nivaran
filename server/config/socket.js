import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

let io = null

export const initSocket = (httpServer) => {
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:5173']

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  })

  // Authenticate in io.use middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      if (!user) {
        return next(new Error('Authentication error: User not found'))
      }

      const tokenVersionInToken = decoded.tokenVersion ?? 0
      const userTokenVersion = user.tokenVersion ?? 0
      if (tokenVersionInToken !== userTokenVersion) {
        return next(new Error('Authentication error: Token version mismatch'))
      }

      // Attach verified user info to socket
      socket.user = {
        _id: user._id.toString(),
        role: user.role,
        municipality: user.municipality ? user.municipality.toString() : null,
      }

      next()
    } catch (err) {
      console.warn('[Socket.io Auth Error]', err.message)
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const { _id, role, municipality } = socket.user
    console.log(`[Socket.io] Authenticated client connected: ${socket.id} (User: ${_id}, Role: ${role}, Muni: ${municipality})`)

    // Join personal room
    socket.join(`user:${_id}`)

    // If admin with municipality, join municipality admin room
    if (role === 'admin' && municipality) {
      const muniAdminRoom = `muni:${municipality}:admins`
      socket.join(muniAdminRoom)
      console.log(`[Socket.io] Admin ${_id} joined room: ${muniAdminRoom}`)
    }

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
