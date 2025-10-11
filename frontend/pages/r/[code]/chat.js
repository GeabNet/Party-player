import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../../../contexts/AuthContext'
import DiscordLayout from '../../../components/DiscordLayout'
import ServerStatus from '../../../components/ServerStatus'
import { io } from 'socket.io-client'

export default function TextChatRoom() {
  const router = useRouter()
  const { code } = router.query
  const { user, userProfile } = useAuth()
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [users, setUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [roomData, setRoomData] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Connect to room
  useEffect(() => {
    if (!code || !user || !userProfile) return

    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      newSocket.emit('join-room', {
        roomCode: code,
        username: userProfile.display_name,
        avatar: userProfile.avatar_url,
        userId: user.id
      })
    })

    newSocket.on('room-joined', (data) => {
      setUsers(data.users || [])
      setRoomData(data.room)
      setIsHost(data.room?.host === user.id)
      setMessages(data.messages || [])
    })

    newSocket.on('user-joined', (data) => {
      setUsers(data.users)
    })

    newSocket.on('user-left', (data) => {
      setUsers(data.users)
    })

    newSocket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message])
    })

    newSocket.on('user-typing', (data) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(u => u.userId !== data.userId)
        return [...filtered, data]
      })
      
      // Remove typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
      }, 3000)
    })

    newSocket.on('user-stopped-typing', (data) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
    })

    newSocket.on('room-error', (error) => {
      setError(error.message || 'An error occurred')
    })

    return () => newSocket.disconnect()
  }, [code, user, userProfile])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !socket) return

    const message = {
      id: Date.now(),
      text: newMessage.trim(),
      username: userProfile.display_name,
      avatar: userProfile.avatar_url,
      userId: user.id,
      timestamp: new Date().toISOString()
    }

    socket.emit('chat-message', message)
    setNewMessage('')
    
    // Stop typing indicator
    socket.emit('stop-typing', { userId: user.id })
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    
    if (!socket) return

    // Send typing indicator
    socket.emit('typing', {
      userId: user.id,
      username: userProfile.display_name
    })

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { userId: user.id })
    }, 1000)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.timestamp).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  const emojiOptions = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '💯', '🎉']

  if (!code || !user || !userProfile) {
    return (
      <DiscordLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading chat...</p>
          </div>
        </div>
      </DiscordLayout>
    )
  }

  return (
    <DiscordLayout currentRoom={code}>
      <Head>
        <title>Text Chat - Room {code}</title>
        <meta name="description" content={`Text chat in room ${code}`} />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <ServerStatus />
        
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push(`/r/${code}/lobby`)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Lobby
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold">Text Chat</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {users.length} user{users.length !== 1 ? 's' : ''} online
              </div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-3 text-center flex-shrink-0">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-2 text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date}>
                  {/* Date Separator */}
                  <div className="text-center my-4">
                    <span className="bg-gray-700 px-3 py-1 rounded-full text-xs text-gray-300">
                      {formatDate(dateMessages[0].timestamp)}
                    </span>
                  </div>
                  
                  {/* Messages for this date */}
                  {dateMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.userId === user.id ? 'justify-end' : 'justify-start'} mb-2`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.userId === user.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-white'
                      }`}>
                        {message.userId !== user.id && (
                          <div className="flex items-center space-x-2 mb-1">
                            <img
                              src={message.avatar || `https://ui-avatars.com/api/?name=${message.username}&background=8B5CF6&color=fff`}
                              alt={message.username}
                              className="w-6 h-6 rounded-full"
                            />
                            <span className="text-xs font-medium text-gray-300">{message.username}</span>
                          </div>
                        )}
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              
              {/* Typing Indicators */}
              {typingUsers.filter(u => u.userId !== user.id).map((typingUser) => (
                <div key={typingUser.userId} className="flex items-center space-x-2 text-gray-400 text-sm">
                  <img
                    src={`https://ui-avatars.com/api/?name=${typingUser.username}&background=8B5CF6&color=fff`}
                    alt={typingUser.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span>{typingUser.username} is typing...</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
              <form onSubmit={sendMessage} className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    maxLength={500}
                  />
                  {/* Emoji Button */}
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white"
                      onClick={() => {
                        // Simple emoji insertion
                        const emoji = emojiOptions[Math.floor(Math.random() * emojiOptions.length)]
                        setNewMessage(prev => prev + emoji)
                      }}
                    >
                      😀
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Send
                </button>
              </form>
              
              {/* Quick Emoji Bar */}
              <div className="flex space-x-2 mt-2">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewMessage(prev => prev + emoji)}
                    className="text-lg hover:bg-gray-700 p-1 rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Sidebar */}
          <div className="w-64 bg-gray-800 border-l border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-4">Online Users ({users.length})</h3>
            <div className="space-y-3">
              {users.map((roomUser) => (
                <div key={roomUser.id} className="flex items-center space-x-3">
                  <img
                    src={roomUser.avatar || `https://ui-avatars.com/api/?name=${roomUser.username}&background=8B5CF6&color=fff`}
                    alt={roomUser.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="text-white font-medium">{roomUser.username}</p>
                    {roomData?.host === roomUser.id && (
                      <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">HOST</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DiscordLayout>
  )
}