import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../../../contexts/AuthContext'
import DiscordLayout from '../../../components/DiscordLayout'
import ServerStatus from '../../../components/ServerStatus'
import { io } from 'socket.io-client'

export default function VoiceChatRoom() {
  const router = useRouter()
  const { code } = router.query
  const { user, userProfile } = useAuth()
  const [socket, setSocket] = useState(null)
  const [users, setUsers] = useState([])
  const [voiceUsers, setVoiceUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [roomData, setRoomData] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isInVoice, setIsInVoice] = useState(false)
  const [speakingUsers, setSpeakingUsers] = useState(new Set())
  const [connectionStatus, setConnectionStatus] = useState('disconnected') // disconnected, connecting, connected

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
      setVoiceUsers(data.voiceUsers || [])
    })

    newSocket.on('user-joined', (data) => {
      setUsers(data.users)
    })

    newSocket.on('user-left', (data) => {
      setUsers(data.users)
      setVoiceUsers(prev => prev.filter(vu => data.users.some(u => u.id === vu.userId)))
    })

    newSocket.on('voice-state-changed', (data) => {
      setVoiceUsers(data.voiceUsers || [])
    })

    newSocket.on('user-speaking', (data) => {
      setSpeakingUsers(prev => new Set([...prev, data.userId]))
      setTimeout(() => {
        setSpeakingUsers(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.userId)
          return newSet
        })
      }, 1000)
    })

    newSocket.on('room-error', (error) => {
      setError(error.message || 'An error occurred')
    })

    return () => newSocket.disconnect()
  }, [code, user, userProfile])

  const joinVoiceChat = async () => {
    if (!socket) return

    try {
      setConnectionStatus('connecting')
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Join voice channel
      socket.emit('join-voice', {
        userId: user.id,
        username: userProfile.display_name,
        avatar: userProfile.avatar_url
      })
      
      setIsInVoice(true)
      setConnectionStatus('connected')
      
      // Set up audio processing for speaking detection
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      microphone.connect(analyser)
      analyser.fftSize = 256
      
      // Speaking detection
      const checkSpeaking = () => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        
        if (average > 10 && !isMuted) { // Threshold for speaking detection
          socket.emit('speaking', { userId: user.id })
        }
        
        if (isInVoice) {
          requestAnimationFrame(checkSpeaking)
        }
      }
      checkSpeaking()
      
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Could not access microphone. Please check permissions.')
      setConnectionStatus('disconnected')
    }
  }

  const leaveVoiceChat = () => {
    if (!socket) return

    socket.emit('leave-voice', { userId: user.id })
    setIsInVoice(false)
    setConnectionStatus('disconnected')
  }

  const toggleMute = () => {
    if (!socket) return

    const newMuted = !isMuted
    setIsMuted(newMuted)
    
    socket.emit('voice-state-change', {
      userId: user.id,
      muted: newMuted,
      deafened: isDeafened
    })
  }

  const toggleDeafen = () => {
    if (!socket) return

    const newDeafened = !isDeafened
    setIsDeafened(newDeafened)
    
    // Deafening also mutes
    if (newDeafened) {
      setIsMuted(true)
    }
    
    socket.emit('voice-state-change', {
      userId: user.id,
      muted: newDeafened || isMuted,
      deafened: newDeafened
    })
  }

  const getVoiceUserStatus = (userId) => {
    const voiceUser = voiceUsers.find(vu => vu.userId === userId)
    if (!voiceUser) return null
    
    return {
      inVoice: true,
      muted: voiceUser.muted || false,
      deafened: voiceUser.deafened || false,
      speaking: speakingUsers.has(userId)
    }
  }

  if (!code || !user || !userProfile) {
    return (
      <DiscordLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p>Loading voice chat...</p>
          </div>
        </div>
      </DiscordLayout>
    )
  }

  return (
    <DiscordLayout currentRoom={code}>
      <Head>
        <title>Voice Chat - Room {code}</title>
        <meta name="description" content={`Voice chat in room ${code}`} />
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
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold">Voice Chat</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {voiceUsers.length} in voice • {users.length} total
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
        <div className="max-w-6xl mx-auto p-6">
          {/* Voice Connection Status */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="text-center">
              {!isInVoice ? (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Join Voice Chat</h2>
                  <p className="text-gray-300 mb-6">Connect your microphone to talk with friends</p>
                  <button
                    onClick={joinVoiceChat}
                    disabled={connectionStatus === 'connecting'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 mx-auto"
                  >
                    {connectionStatus === 'connecting' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                        <span>Join Voice Chat</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-4 text-green-400">Connected to Voice Chat</h2>
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    {/* Mute Button */}
                    <button
                      onClick={toggleMute}
                      className={`p-3 rounded-full transition-colors ${
                        isMuted 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Deafen Button */}
                    <button
                      onClick={toggleDeafen}
                      className={`p-3 rounded-full transition-colors ${
                        isDeafened 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      title={isDeafened ? 'Undeafen' : 'Deafen'}
                    >
                      {isDeafened ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 4a3 3 0 00-3 3v1H5a3 3 0 00-3 3v3a3 3 0 003 3h1v1a3 3 0 006 0v-1h1a3 3 0 003-3v-3a3 3 0 00-3-3h-2V7a3 3 0 00-3-3z"/>
                        </svg>
                      )}
                    </button>

                    {/* Leave Voice */}
                    <button
                      onClick={leaveVoiceChat}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                      Leave Voice
                    </button>
                  </div>
                  
                  {(isMuted || isDeafened) && (
                    <div className="text-sm text-yellow-400">
                      {isDeafened ? 'You are deafened and muted' : 'You are muted'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Voice Users */}
          {voiceUsers.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">🎤</span>
                In Voice Chat ({voiceUsers.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {voiceUsers.map((voiceUser) => {
                  const status = getVoiceUserStatus(voiceUser.userId)
                  const user = users.find(u => u.id === voiceUser.userId)
                  
                  return (
                    <div key={voiceUser.userId} className="text-center">
                      <div className="relative">
                        <img
                          src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || voiceUser.username}&background=8B5CF6&color=fff`}
                          alt={user?.username || voiceUser.username}
                          className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 transition-all ${
                            status?.speaking 
                              ? 'border-green-400 shadow-lg shadow-green-400/50' 
                              : status?.muted 
                                ? 'border-red-400' 
                                : 'border-green-400'
                          }`}
                        />
                        
                        {/* Voice Status Indicators */}
                        <div className="absolute -bottom-1 -right-1 flex space-x-1">
                          {status?.muted && (
                            <div className="bg-red-600 rounded-full p-1">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          {status?.deafened && (
                            <div className="bg-red-600 rounded-full p-1">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-white font-medium">{user?.username || voiceUser.username}</p>
                      {status?.speaking && (
                        <p className="text-xs text-green-400 font-medium">Speaking</p>
                      )}
                      {roomData?.host === voiceUser.userId && (
                        <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">HOST</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Users */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">👥</span>
              All Users in Room ({users.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {users.map((user) => {
                const status = getVoiceUserStatus(user.id)
                
                return (
                  <div key={user.id} className="text-center">
                    <img
                      src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=8B5CF6&color=fff`}
                      alt={user.username}
                      className={`w-12 h-12 rounded-full mx-auto mb-2 border-2 ${
                        status?.inVoice ? 'border-green-400' : 'border-gray-500'
                      }`}
                    />
                    <p className="text-sm text-white font-medium">{user.username}</p>
                    <p className="text-xs text-gray-400">
                      {status?.inVoice ? 'In Voice' : 'Not in Voice'}
                    </p>
                    {roomData?.host === user.id && (
                      <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">HOST</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </DiscordLayout>
  )
}