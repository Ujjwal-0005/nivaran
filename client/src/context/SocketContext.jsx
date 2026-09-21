import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const socketRef = useRef(null)

  useEffect(() => {
    if (isAuthenticated() && user) {
      // Connect to backend Socket.io
      const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
      })

      newSocket.on('connect', () => {
        console.log('[Socket] Connected to server, registering user:', user.id || user._id, user.role)
        newSocket.emit('register', {
          userId: user.id || user._id,
          role: user.role,
        })
      })

      // Generic notification handler
      const handleIncomingNotification = (type, data) => {
        const notifItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          data,
          title:
            type === 'status_update'
              ? `Status Update: ${data.ticketId}`
              : type === 'new_assignment'
              ? `New Ticket Assigned: ${data.ticketId}`
              : type === 'ticket_escalated'
              ? `🚨 SLA Escalation: ${data.ticketId}`
              : type === 'new_comment'
              ? `New Note on ${data.ticketId}`
              : 'Notification',
          message: data.message || 'You have a new update.',
          timestamp: new Date(),
          read: false,
        }

        setNotifications((prev) => [notifItem, ...prev.slice(0, 49)]) // keep last 50
        setUnreadCount((c) => c + 1)
      }

      newSocket.on('status_update', (data) => {
        handleIncomingNotification('status_update', data)
      })

      newSocket.on('new_assignment', (data) => {
        handleIncomingNotification('new_assignment', data)
      })

      newSocket.on('ticket_escalated', (data) => {
        handleIncomingNotification('ticket_escalated', data)
      })

      newSocket.on('new_comment', (data) => {
        handleIncomingNotification('new_comment', data)
      })

      socketRef.current = newSocket
      setSocket(newSocket)

      return () => {
        console.log('[Socket] Disconnecting socket on cleanup/logout')
        newSocket.disconnect()
        socketRef.current = null
        setSocket(null)
      }
    } else {
      // User logged out or unauthenticated
      if (socketRef.current) {
        console.log('[Socket] Disconnecting socket on user logout')
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user])

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const clearNotifications = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
