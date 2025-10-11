import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../../../contexts/AuthContext'
import DiscordLayout from '../../../components/DiscordLayout'
import ServerStatus from '../../../components/ServerStatus'
import { io } from 'socket.io-client'

export default function WatchPartyRoom() {
  const router = useRouter()
  const { code } = router.query
  const { user, userProfile } = useAuth()
  const [socket, setSocket] = useState(null)
  const [users, setUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [roomData, setRoomData] = useState(null)
  
  // Video states
  const [currentVideo, setCurrentVideo] = useState(null)
  const [player, setPlayer] = useState(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [syncData, setSyncData] = useState({ time: 0, playing: false })
  const [lastSyncTime, setLastSyncTime] = useState(0)
  
  // Chat states
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // YouTube API
  useEffect(() => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      const newPlayer = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            setPlayer(event.target)
            setIsPlayerReady(true)
          },
          onStateChange: (event) => {
            if (!socket || !isHost) return
            
            const time = event.target.getCurrentTime()
            const playing = event.data === window.YT.PlayerState.PLAYING
            
            // Only sync if the change is from user interaction (not from sync)
            if (Date.now() - lastSyncTime > 1000) {
              socket.emit('video-sync', {
                time,
                playing,
                timestamp: Date.now()
              })
            }
          }
        }
      })
    }
  }, [])

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
      setCurrentVideo(data.currentVideo)
      setMessages(data.messages || [])
      
      // Sync video state if there's a current video
      if (data.currentVideo && data.videoSync) {
        setSyncData(data.videoSync)
      }
    })

    newSocket.on('user-joined', (data) => {
      setUsers(data.users)
    })

    newSocket.on('user-left', (data) => {
      setUsers(data.users)
    })

    newSocket.on('video-loaded', (data) => {
      setCurrentVideo(data.video)
      if (player && isPlayerReady) {
        player.loadVideoById(data.video.videoId)
      }
    })

    newSocket.on('video-sync', (data) => {
      if (player && isPlayerReady && !isHost) {
        setLastSyncTime(Date.now())
        setSyncData(data)
        
        const currentTime = player.getCurrentTime()
        const timeDiff = Math.abs(currentTime - data.time)
        
        // Only seek if time difference is significant
        if (timeDiff > 2) {
          player.seekTo(data.time, true)
        }
        
        if (data.playing) {
          player.playVideo()
        } else {
          player.pauseVideo()
        }
      }
    })

    newSocket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message])
    })

    newSocket.on('room-error', (error) => {
      setError(error.message || 'An error occurred')
    })

    return () => newSocket.disconnect()
  }, [code, user, userProfile, player, isPlayerReady, isHost])

  // Sync video when player becomes ready
  useEffect(() => {
    if (player && isPlayerReady && currentVideo && syncData.time !== undefined) {
      player.loadVideoById(currentVideo.videoId)
      setTimeout(() => {
        player.seekTo(syncData.time, true)
        if (syncData.playing) {
          player.playVideo()
        }
      }, 1000)
    }
  }, [player, isPlayerReady, currentVideo])

  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const loadVideo = async () => {
    if (!videoUrl.trim() || !socket || !isHost) return

    const videoId = extractVideoId(videoUrl)
    if (!videoId) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setIsLoadingVideo(true)
    
    try {
      // Get video title from YouTube API (simplified)
      const video = {
        videoId,
        title: 'Loading...',
        url: videoUrl.trim()
      }

      socket.emit('load-video', video)
      setVideoUrl('')
    } catch (err) {
      setError('Failed to load video')
    } finally {
      setIsLoadingVideo(false)
    }
  }

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
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!code || !user || !userProfile) {
    return (
      <DiscordLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Loading watch party...</p>
          </div>
        </div>
      </DiscordLayout>
    )
  }

  return (
    <DiscordLayout currentRoom={code}>
      <Head>
        <title>Watch Party - Room {code}</title>
        <meta name="description" content={`Watch party in room ${code}`} />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        <ServerStatus />
        
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push(`/r/${code}/lobby`)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Lobby
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold">Watch Party</h1>
                {isHost && <span className="bg-purple-600 text-xs px-2 py-1 rounded">HOST</span>}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {users.length} viewer{users.length !== 1 ? 's' : ''}
              </div>
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
        <div className="flex flex-1 h-[calc(100vh-120px)]">
          {/* Video Area */}
          <div className="flex-1 p-4">
            <div className="bg-gray-800 rounded-xl overflow-hidden h-full flex flex-col">
              {/* Video Container */}
              <div className="flex-1 bg-black rounded-t-xl relative">
                {currentVideo ? (
                  <div id="youtube-player" className="w-full h-full"></div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      </div>
                      <h3 className="text-xl text-gray-300 mb-2">No Video Playing</h3>
                      <p className="text-gray-500">
                        {isHost ? 'Load a YouTube video to get started' : 'Waiting for host to start a video'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              {currentVideo && (
                <div className="p-4 bg-gray-800">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {currentVideo.title}
                  </h3>
                </div>
              )}

              {/* Video Controls (Host Only) */}
              {isHost && (
                <div className="p-4 bg-gray-800 border-t border-gray-700">
                  <form onSubmit={(e) => { e.preventDefault(); loadVideo(); }} className="flex space-x-2">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Paste YouTube URL here..."
                      className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={!videoUrl.trim() || isLoadingVideo}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      {isLoadingVideo ? 'Loading...' : 'Load Video'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Watch Party Chat</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="flex space-x-3">
                  <img
                    src={message.avatar || `https://ui-avatars.com/api/?name=${message.username}&background=8B5CF6&color=fff`}
                    alt={message.username}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">{message.username}</span>
                      <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 break-words">{message.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={sendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={200}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Users Bar */}
        <div className="bg-gray-800 border-t border-gray-700 p-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center space-x-4 overflow-x-auto">
              <span className="text-sm text-gray-400 whitespace-nowrap">Watching:</span>
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2 whitespace-nowrap">
                  <img
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=8B5CF6&color=fff`}
                    alt={user.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm text-white">{user.username}</span>
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