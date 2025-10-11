import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext({})

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const { user, userProfile } = useAuth()
  const heartbeatInterval = useRef(null)

  // Initialize socket connection
  useEffect(() => {
    if (user && userProfile) {
      console.log('Initializing socket connection for user:', userProfile.username)
      
      // Determine server URL
      const serverUrl = process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_SERVER_URL || 'https://your-server-url.com'
        : 'http://localhost:3001'

      // Create socket connection
      const newSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      })

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id)
        setIsConnected(true)
        
        // Notify server that user is online
        newSocket.emit('user-online', {
          userId: user.id,
          userProfile: userProfile
        })

        // Start heartbeat to maintain online status
        startHeartbeat(newSocket, user.id)
      })

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected')
        setIsConnected(false)
        stopHeartbeat()
      })

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        setIsConnected(false)
      })

      // Online users event handlers
      newSocket.on('online-users-updated', (users) => {
        console.log('Online users updated:', users)
        setOnlineUsers(users || [])
      })

      setSocket(newSocket)

      // Cleanup on unmount
      return () => {
        console.log('Cleaning up socket connection')
        stopHeartbeat()
        newSocket.disconnect()
      }
    }
  }, [user, userProfile])

  // Start heartbeat to maintain online status
  const startHeartbeat = (socket, userId) => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
    }

    heartbeatInterval.current = setInterval(() => {
      if (socket && socket.connected && userId) {
        socket.emit('heartbeat', { userId })
      }
    }, 30000) // Send heartbeat every 30 seconds
  }

  // Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }
  }

  // Get current online users
  const refreshOnlineUsers = () => {
    if (socket && socket.connected) {
      socket.emit('get-online-users')
    }
  }

  // Filter online users to exclude current user and friends
  const getFilteredOnlineUsers = (friends = []) => {
    return onlineUsers.filter(onlineUser => {
      // Exclude current user
      if (!user || onlineUser.id === user.id) return false
      
      // Exclude existing friends
      const isFriend = friends.some(friend => friend.id === onlineUser.id)
      return !isFriend
    })
  }

  const value = {
    socket,
    isConnected,
    onlineUsers,
    refreshOnlineUsers,
    getFilteredOnlineUsers
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}