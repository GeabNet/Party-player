import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../../../contexts/AuthContext'
import DiscordLayout from '../../../components/DiscordLayout'
import ServerStatus from '../../../components/ServerStatus'
import { io } from 'socket.io-client'

export default function RoomLobby() {
  const router = useRouter()
  const { code } = router.query
  const { user, userProfile } = useAuth()
  const [socket, setSocket] = useState(null)
  const [roomData, setRoomData] = useState(null)
  const [users, setUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState('')
  const [isHost, setIsHost] = useState(false)

  // Connect to room and get basic info
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
    })

    newSocket.on('user-joined', (data) => {
      setUsers(data.users)
    })

    newSocket.on('user-left', (data) => {
      setUsers(data.users)
    })

    newSocket.on('room-error', (error) => {
      setError(error.message || 'An error occurred')
    })

    return () => newSocket.disconnect()
  }, [code, user, userProfile])

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy room code:', err)
    }
  }

  if (!code || !user || !userProfile) {
    return (
      <DiscordLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Loading room...</p>
          </div>
        </div>
      </DiscordLayout>
    )
  }

  return (
    <DiscordLayout currentRoom={code}>
      <Head>
        <title>Room Lobby - {code}</title>
        <meta name="description" content={`Join activities in room ${code}`} />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        <ServerStatus />
        
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Home
              </button>
              <h1 className="text-2xl font-bold">Room {code}</h1>
              {isHost && <span className="bg-purple-600 text-xs px-2 py-1 rounded">HOST</span>}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {users.length} user{users.length !== 1 ? 's' : ''} online
              </div>
              <button
                onClick={copyRoomCode}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
              >
                📋 Copy Code
              </button>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-3 text-center">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-2 text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto p-6">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Welcome to Room {code}
            </h2>
            <p className="text-gray-300 text-lg">
              Choose an activity to get started with your friends
            </p>
          </div>

          {/* Activity Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Text Chat Card */}
            <Link href={`/r/${code}/chat`}>
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/25">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Text Chat</h3>
                  <p className="text-blue-100 text-sm">
                    WhatsApp-style group chat with messages and emojis
                  </p>
                </div>
              </div>
            </Link>

            {/* Voice Chat Card */}
            <Link href={`/r/${code}/voice`}>
              <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-green-500/25">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Voice Chat</h3>
                  <p className="text-green-100 text-sm">
                    Talk with friends using voice communication
                  </p>
                </div>
              </div>
            </Link>

            {/* Watch Party Card */}
            <Link href={`/r/${code}/watch`}>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25">
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Watch Party</h3>
                  <p className="text-purple-100 text-sm">
                    Watch YouTube videos together in sync
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Users in Room */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">👥</span>
              Users in Room ({users.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {users.map((user) => (
                <div key={user.id} className="text-center">
                  <img
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=8B5CF6&color=fff`}
                    alt={user.username}
                    className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-purple-400"
                  />
                  <p className="text-sm text-white font-medium">{user.username}</p>
                  {roomData?.host === user.id && (
                    <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">HOST</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DiscordLayout>
  )
}