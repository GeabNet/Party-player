import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io } from 'socket.io-client';
import ServerStatus from '../../components/ServerStatus';
import VoiceChat from '../../components/ModernVoiceChat';
import VideoChat from '../../components/VideoChat';
import InviteFriends from '../../components/InviteFriends';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl, getYouTubeApiUrl } from '../../utils/urls';

/**
 * Room page component - main watch party interface
 * Handles video synchronization, chat, and room management
 */
export default function Room() {
  const router = useRouter();
  const { code } = router.query;
  const { user, userProfile, loading, sessionRestored, sendFriendRequest } = useAuth();
  
  // Socket and room state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);

  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRef = useRef(null);
  const [recommendations, setRecommendations] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef(null);

  // UI state
  const [error, setError] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [showYouTubeSection, setShowYouTubeSection] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [showVideoChat, setShowVideoChat] = useState(false);

  /**
   * Redirect to login if not authenticated
   */
  useEffect(() => {
    if (sessionRestored && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, sessionRestored, router]);

  // Voice chat state
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, targetUser: null });
  const [friendRequestLoading, setFriendRequestLoading] = useState(false);

  /**
   * Load YouTube IFrame API
   */
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.YT) {
      console.log('Loading YouTube IFrame API...');

      // Add API script
      const tag = document.createElement('script');
      tag.src = getYouTubeApiUrl();
      tag.async = true;
      tag.onerror = () => {
        console.warn('Failed to load YouTube API script');
        // Try loading again after a delay
        setTimeout(() => {
          if (!window.YT && !isPlayerReady) {
            console.log('Retrying YouTube API load...');
            const retryTag = document.createElement('script');
            retryTag.src = getYouTubeApiUrl();
            retryTag.async = true;
            document.head.appendChild(retryTag);
          }
        }, 3000);
      };

      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // Set up callback
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API loaded successfully');
        setIsPlayerReady(true);
        setError(''); // Clear any previous errors
      };

      // Fallback: check if API is already loaded (longer timeout)
      setTimeout(() => {
        if (window.YT && window.YT.Player && !isPlayerReady) {
          console.log('YouTube API was already loaded');
          setIsPlayerReady(true);
          setError('');
        } else if (!isPlayerReady) {
          console.warn('YouTube API is taking longer to load, but videos should still work');
          setError('YouTube API is loading slowly. Videos may take a moment to start.');
          // Keep checking every 5 seconds
          const checkInterval = setInterval(() => {
            if (window.YT && window.YT.Player && !isPlayerReady) {
              console.log('YouTube API loaded after delay');
              setIsPlayerReady(true);
              setError('');
              clearInterval(checkInterval);
            }
          }, 5000);
        }
      }, 10000); // Increased timeout to 10 seconds
    } else if (window.YT && window.YT.Player) {
      console.log('YouTube API already available');
      setIsPlayerReady(true);
      setError('');
    }

    // Check if mobile
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // Close context menu when clicking elsewhere
    const handleClickOutside = () => setContextMenu({ show: false, x: 0, y: 0, targetUser: null });
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Load video in YouTube player
   */
  const loadVideoInPlayer = useCallback((videoId) => {
    console.log('loadVideoInPlayer called with videoId:', videoId);

    if (!window.YT || !window.YT.Player) {
      console.error('YouTube API not ready, cannot load video');
      setError('YouTube API not loaded. Please refresh the page and try again.');
      setIsVideoLoading(false);
      return;
    }

    // Check if youtube-player element exists
    const playerElement = document.getElementById('youtube-player');
    console.log('Player element exists:', !!playerElement);

    if (!playerElement) {
      console.error('YouTube player element not found');
      return;
    }

    // Destroy existing player
    if (playerRef.current) {
      console.log('Destroying existing player');
      playerRef.current.destroy();
    }

    console.log('Creating new YouTube player...');

    // Create new player
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: isHost ? 1 : 0, // Only host gets controls
        disablekb: !isHost ? 1 : 0,
        fs: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1
      },
      events: {
        onReady: (event) => {
          console.log('YouTube player ready for video:', videoId);
        },
        onStateChange: (event) => {
          console.log('Player state changed:', event.data);
          if (!isHost) return; // Only host can trigger sync events

          const currentTime = event.target.getCurrentTime();

          if (event.data === window.YT.PlayerState.PLAYING) {
            socket?.emit('video-play', { roomCode: code.toUpperCase(), currentTime });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            socket?.emit('video-pause', { roomCode: code.toUpperCase(), currentTime });
          }
        },
        onError: (event) => {
          console.error('YouTube player error:', event.data);
          setError(`YouTube player error: ${event.data}`);
        }
      }
    });
  }, [isHost, socket, code, setError, setIsVideoLoading]);

  /**
   * Initialize socket connection and join room
   */
  useEffect(() => {
    if (!code || !user || !userProfile) return;

    // Reset initial load flag when joining a new room
    setIsInitialLoad(true);

    console.log('Creating Socket.IO connection...');

    // Create socket with stable configuration
    const socketInstance = io(process.env.NEXT_PUBLIC_SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server, joining room:', code);
      
      // Prepare user data for room join
      const userData = {
        roomCode: code.toUpperCase(),
        username: userProfile.display_name,
        avatar: userProfile.avatar_url,
        isAuthenticated: true,
        userId: user.id,
        userProfile: userProfile
      };
      
      socketInstance.emit('join-room', userData);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from server:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Connection failed. Retrying...');
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setError('');
      
      // Rejoin room after reconnection with updated user data
      const userData = {
        roomCode: code.toUpperCase(),
        username: userProfile.display_name,
        avatar: userProfile.avatar_url,
        isAuthenticated: true,
        userId: user.id,
        userProfile: userProfile
      };
      
      socketInstance.emit('join-room', userData);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Reconnection failed:', error);
    });

    socketInstance.on('joined-room', (data) => {
      console.log('Joined room data:', data);
      console.log('Users with avatars:', data.users?.map(u => ({ username: u.username, hasAvatar: !!u.avatar })));
      setRoomData(data);
      setIsHost(data.isHost);
      setCurrentVideo(data.currentVideo);
      setMessages(data.messages || []);
      setUsers(data.users || []);
      setError(''); // Clear any connection errors
      setIsInitialLoad(false); // Mark that initial load is complete
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data.message);
      setError(data.message);
      // If room not found, redirect to home after 3 seconds
      if (data.message === 'Room not found') {
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    });

    // Video events
    socketInstance.on('video-loaded', (data) => {
      setCurrentVideo({ videoId: data.videoId, title: data.title });
      setIsVideoLoading(false);
      loadVideoInPlayer(data.videoId);
    });

    socketInstance.on('video-play', (data) => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.playVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.playVideo();
      }
    });

    socketInstance.on('video-pause', (data) => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.pauseVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.pauseVideo();
      }
    });

    socketInstance.on('video-seek', (data) => {
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(data.time, true);
      }
    });

    // Chat events
    socketInstance.on('new-message', (message) => {
      console.log('New message received:', message);
      setMessages(prev => [...prev, message]);
    });

    // User events
    socketInstance.on('user-joined', (data) => {
      console.log('User joined:', data.user);
      setUsers(prev => [...prev, data.user]);
    });

    socketInstance.on('user-left', (data) => {
      console.log('User left:', data.user);
      setUsers(prev => prev.filter(u => u.id !== data.user.id));
      if (data.newHost) {
        setIsHost(data.newHost.id === socketInstance.id);
      }
    });

    socketInstance.on('new-host', (data) => {
      setIsHost(data.newHost.id === socketInstance.id);
    });

    // Voice chat events
    socketInstance.on('voice-chat-users', (users) => {
      console.log('Voice chat users updated:', users);
      setVoiceUsers(users || []);
    });

    socketInstance.on('user-joined-voice', (data) => {
      console.log('User joined voice:', data);
      setVoiceUsers(prev => [...new Set([...prev, data.callerID])]);
    });

    socketInstance.on('user-left-voice', (data) => {
      console.log('User left voice:', data);
      setVoiceUsers(prev => prev.filter(id => id !== data.callerID));
      setMutedUsers(prev => prev.filter(id => id !== data.callerID));
    });

    // Mute status events
    socketInstance.on('user-muted', (data) => {
      console.log('User muted received:', data);
      setMutedUsers(prev => {
        const newMutedUsers = [...new Set([...prev, data.userId])];
        console.log('Updated muted users:', newMutedUsers);
        return newMutedUsers;
      });
    });

    socketInstance.on('user-unmuted', (data) => {
      console.log('User unmuted received:', data);
      setMutedUsers(prev => {
        const newMutedUsers = prev.filter(id => id !== data.userId);
        console.log('Updated muted users:', newMutedUsers);
        return newMutedUsers;
      });
    });

    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.disconnect();
      setIsInitialLoad(true); // Reset for next room join
    };
  }, [code, user, userProfile]); // Only depend on code and user to prevent unnecessary reconnections

  /**
   * Auto-scroll chat to bottom (only for new messages, not initial load)
   */
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isInitialLoad]);

  /**
   * Create YouTube player when ready and video is loaded
   */
  useEffect(() => {
    if (isPlayerReady && currentVideo && currentVideo.videoId && !playerRef.current) {
      loadVideoInPlayer(currentVideo.videoId);
    }
  }, [isPlayerReady, currentVideo, loadVideoInPlayer]);

  /**
   * Copy room code to clipboard
   */
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(code.toUpperCase());
      // Show temporary success feedback
      const button = document.querySelector('[data-copy-button]');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.backgroundColor = '#10b981';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '';
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy room code:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code.toUpperCase();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  /**
   * Load a new video (host only)
   */
  const loadVideo = () => {
    if (!isHost) {
      setError('Only the host can load videos');
      return;
    }

    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsVideoLoading(true);
    setError('');
    
    socket.emit('load-video', { 
      roomCode: code.toUpperCase(), 
      videoUrl: videoUrl.trim() 
    });
    
    setVideoUrl('');
  };

  /**
   * Send chat message
   */
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', {
      roomCode: code.toUpperCase(),
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  /**
   * Get AI recommendations
   */
  const getRecommendations = async () => {
    if (!currentVideo || !currentVideo.videoId) {
      setError('Load a video first to get recommendations');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/recommend?videoId=${currentVideo.videoId}`
      );
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Error getting recommendations:', err);
      setError('Failed to get recommendations');
    }
  };

  /**
   * Load recommended video
   */
  const loadRecommendedVideo = (videoId) => {
    if (!isHost) {
      setError('Only the host can load videos');
      return;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    setIsVideoLoading(true);
    
    socket.emit('load-video', { 
      roomCode: code.toUpperCase(), 
      videoUrl 
    });
  };

  /**
   * Copy room link to clipboard
   */
  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      // Could show a toast notification here
      console.log('Room link copied to clipboard');
    });
  };

  /**
   * Handle key press events
   */
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  /**
   * Handle right-click on user to show context menu
   */
  const handleUserRightClick = (e, targetUser) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't show context menu for current user
    if (targetUser.id === user?.id || targetUser.username === userProfile?.display_name) {
      return;
    }
    
    setContextMenu({
      show: true,
      x: e.pageX,
      y: e.pageY,
      targetUser
    });
  };

  /**
   * Send friend request to user
   */
  const handleSendFriendRequest = async () => {
    if (!contextMenu.targetUser) return;
    
    setFriendRequestLoading(true);
    setError(''); // Clear any existing errors
    
    try {
      console.log('Sending friend request to:', contextMenu.targetUser.username, 'with ID:', contextMenu.targetUser.id || contextMenu.targetUser.userId);
      
      // Use the correct user ID field
      const targetUserId = contextMenu.targetUser.id || contextMenu.targetUser.userId;
      if (!targetUserId) {
        throw new Error('Target user ID not found');
      }
      
      const result = await sendFriendRequest(targetUserId);
      console.log('Friend request result:', result);
      
      if (result && result.error) {
        console.error('Friend request error:', result.error);
        setError(`Failed to send friend request: ${result.error.message}`);
      } else if (result && result.success) {
        console.log('Friend request sent successfully');
        // Show success message (you could add a toast notification here)
        console.log('✅ Friend request sent to', contextMenu.targetUser.username);
      } else {
        console.warn('Unexpected friend request response:', result);
        // Assume success if no error and no explicit success flag
      }
    } catch (err) {
      console.error('Friend request exception:', err);
      setError(`Failed to send friend request: ${err.message}`);
    } finally {
      setFriendRequestLoading(false);
      setContextMenu({ show: false, x: 0, y: 0, targetUser: null });
    }
  };

  if (!code || !user || !userProfile) {
    if (loading) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Access Denied</h1>
          <p className="mb-4">You must be logged in to access this room.</p>
          <button 
            onClick={() => router.push('/login')}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg transition-colors mr-4"
          >
            Sign In
          </button>
          <button 
            onClick={() => router.push('/')}
            className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Watch Party - Room {code}</title>
        <meta name="description" content={`Join the watch party in room ${code}`} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        <ServerStatus />
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold">Room {code}</h1>
              {isHost && <span className="bg-purple-600 text-xs px-2 py-1 rounded">HOST</span>}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {users.length} user{users.length !== 1 ? 's' : ''} online
              </div>
              <button
                onClick={copyRoomCode}
                data-copy-button
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
        <div className="max-w-7xl mx-auto p-4">
          <div className="space-y-6">
            
            {/* Apps Toggle: show only an icon when closed, full panel when open */}
            {!appsOpen ? (
              <div className="flex items-center">
                <button
                  onClick={() => setAppsOpen(true)}
                  className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 focus-ring"
                  aria-label="Open apps and activities"
                >
                  <i className="bi bi-grid-3x3-gap-fill text-xl" />
                </button>
              </div>
            ) : (
              <div className="relative bg-gradient-to-r from-gray-800 via-gray-800 to-gray-700 rounded-xl p-6 border border-gray-600 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xl bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    <i className="bi bi-grid-3x3-gap-fill mr-2" /> Apps & Activities
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAppsOpen(false)}
                      className="p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 focus-ring"
                      aria-label="Close apps"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </div>

                {/* Desktop: grid, Mobile: horizontal scroll */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* YouTube Watch Party App */}
                  <button
                    onClick={() => setShowYouTubeSection(!showYouTubeSection)}
                    className={`group relative overflow-hidden p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
                      showYouTubeSection 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-500 shadow-lg shadow-red-500/25' 
                        : 'bg-gradient-to-r from-gray-700 to-gray-800 border-gray-600 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/25'
                    }`}>
                    <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    <div className="relative text-center">
                      <div className="text-4xl mb-3">
                        <i className="bi bi-youtube text-red-500 text-4xl" />
                      </div>
                      <h4 className="text-white font-bold text-lg mb-2">
                        YouTube Frame
                      </h4>
                      <p className="text-gray-300 text-sm">
                        {showYouTubeSection ? 'Hide YouTube Player' : 'Watch videos together'}
                      </p>
                      {currentVideo && (
                        <div className="mt-2 px-2 py-1 bg-red-600/20 rounded-full">
                          <span className="text-xs text-red-300">• Now Playing</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Video Chat App */}
                  <div className="p-6 rounded-xl border-2 transition-all duration-200 hover:scale-105 cursor-pointer" onClick={() => setShowVideoChat(!showVideoChat)}>
                    <div className="text-4xl mb-3"><i className="bi bi-camera-video" /></div>
                    <h4 className="text-white font-bold text-lg mb-2">Video Chat</h4>
                    <p className="text-gray-300 text-sm">Start a video call with room members</p>
                  </div>

                  {/* Future Apps - Placeholder */}
                  <div className="p-6 rounded-xl border-2 border-dashed border-gray-600 text-center opacity-50">
                    <div className="text-4xl mb-3"><i className="bi bi-music-note-list" /></div>
                    <h4 className="text-gray-400 font-bold text-lg mb-2">Music Player</h4>
                    <p className="text-gray-500 text-sm">Coming Soon</p>
                  </div>
                </div>

                {/* Mobile horizontal scroll */}
                <div className="md:hidden apps-scroll-row">
                  <button
                    onClick={() => setShowYouTubeSection(!showYouTubeSection)}
                    className={`group relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 app-card-mobile ${
                      showYouTubeSection 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-500 shadow-lg shadow-red-500/25' 
                        : 'bg-gradient-to-r from-gray-700 to-gray-800 border-gray-600 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/25'
                    }`}>
                    <div className="relative text-center">
                      <div className="mb-2">
                        <i className="bi bi-youtube text-red-500 text-3xl" />
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">
                        YouTube
                      </h4>
                      <p className="text-gray-300 text-xs">
                        {showYouTubeSection ? 'Hide' : 'Watch'}
                      </p>
                    </div>
                  </button>

                  <div className="p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 app-card-mobile cursor-pointer" onClick={() => setShowVideoChat(!showVideoChat)}>
                    <div className="mb-2"><i className="bi bi-camera-video text-3xl" /></div>
                    <h4 className="text-white font-bold text-sm mb-1">Video Chat</h4>
                    <p className="text-gray-300 text-xs">Call</p>
                  </div>

                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-600 text-center opacity-50 app-card-mobile">
                    <div className="mb-2"><i className="bi bi-music-note-list text-3xl" /></div>
                    <h4 className="text-gray-400 font-bold text-sm mb-1">Music</h4>
                    <p className="text-gray-500 text-xs">Soon</p>
                  </div>
                </div>
              </div>
            )}

            {/* YouTube Section - Only show when button is clicked */}
            {showYouTubeSection && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Video Controls - Host Only */}
                {isHost && (
                  <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-sm rounded-lg p-4 border border-red-600/30">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 rounded-lg bg-red-600">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white">YouTube Player Controls</h3>
                      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">HOST ONLY</span>
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, loadVideo)}
                        placeholder="Paste YouTube URL here..."
                        className="flex-1 px-3 py-2 bg-black/30 border border-red-500/30 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent text-white placeholder-red-200"
                      />
                      <button
                        onClick={loadVideo}
                        disabled={isVideoLoading}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors text-white font-medium"
                      >
                        {isVideoLoading ? 'Loading...' : 'Load Video'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Video Player */}
                <div className="bg-black rounded-lg overflow-hidden aspect-video border-2 border-red-600/30">
                  {currentVideo ? (
                    <div id="youtube-player" className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🎬</div>
                        <div className="text-xl mb-2 text-white">No video loaded</div>
                        <div className="text-sm text-gray-300">
                          {isHost ? 'Load a YouTube video to get started' : 'Waiting for the host to load a video...'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Video Info */}
                {currentVideo && (
                  <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-sm rounded-lg p-4 border border-red-600/30">
                    <h3 className="font-semibold mb-1 text-white">Now Playing:</h3>
                    <p className="text-red-200">{currentVideo.title}</p>
                    {!isHost && (
                      <p className="text-sm text-red-300 mt-2">
                        Video controls are managed by the host
                      </p>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {isHost && (
                  <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-sm rounded-lg p-4 border border-red-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">AI Recommendations</h3>
                      <button
                        onClick={getRecommendations}
                        disabled={!currentVideo}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 text-sm rounded transition-colors text-white"
                      >
                        Get Recommendations
                      </button>
                    </div>
                    
                    {recommendations.length > 0 ? (
                      <div className="space-y-2">
                        {recommendations.map((rec) => (
                          <div key={rec.videoId} className="flex items-center justify-between bg-black/30 p-2 rounded border border-red-600/20">
                            <div className="flex-1 text-sm text-white">{rec.title}</div>
                            <button
                              onClick={() => loadRecommendedVideo(rec.videoId)}
                              className="bg-red-600 hover:bg-red-700 px-2 py-1 text-xs rounded ml-2 transition-colors text-white"
                            >
                              Load
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-300 text-sm">
                        Load a video and click &quot;Get Recommendations&quot; to see AI-suggested videos
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Users Section - Now below video */}
            <div className="w-full">
              <div className="bg-gradient-to-r from-gray-800 via-gray-800 to-gray-700 rounded-xl p-4 border border-gray-600 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    👥 Users in Room ({users.length})
                  </h3>
                  <div className="flex items-center space-x-4">
                    {/* Invite Friends Button (for authenticated hosts) */}
                    {user && userProfile && isHost && (
                      <button
                        onClick={() => setShowInviteFriends(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm font-medium"
                      >
                        👥 Invite Friends
                      </button>
                    )}
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      <span className="text-sm text-gray-300">
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {users.map((user) => {
                    const isInVoiceChat = voiceUsers.includes(user.id);
                    const isMuted = mutedUsers.includes(user.id);
                    
                    // Debug logging
                    console.log('User card render:', {
                      username: user.username,
                      userId: user.id,
                      isInVoiceChat,
                      isMuted,
                      voiceUsers,
                      mutedUsers
                    });
                    
                    return (
                      <div 
                        key={user.id} 
                        className={`group rounded-lg p-3 border transition-all duration-300 hover:shadow-lg transform hover:scale-105 cursor-pointer ${
                          isInVoiceChat && isMuted
                            ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 border-red-300 border-2 hover:border-red-200 hover:shadow-red-300/80 shadow-red-400/70 ring-2 ring-red-400/60'
                            : isInVoiceChat 
                            ? 'bg-gradient-to-br from-indigo-600/40 via-purple-700/30 to-pink-800/40 border-purple-400/60 hover:border-pink-300 hover:shadow-purple-500/30 shadow-purple-500/20' 
                            : 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 hover:border-purple-500 hover:shadow-purple-500/20'
                        }`}
                        onContextMenu={(e) => handleUserRightClick(e, user)}
                        title={user.id !== user?.id && user.username !== userProfile?.display_name ? "Right-click to add friend" : ""}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          {/* Avatar */}
                          <div className="relative">
                            <img
                              src={user.avatar || getAvatarUrl(user.username.charAt(0).toUpperCase())}
                              alt={user.username}
                              className={`w-10 h-10 rounded-full border-2 shadow-lg object-cover ${
                                isInVoiceChat 
                                  ? isMuted 
                                    ? 'border-red-400 ring-4 ring-red-500/60 shadow-red-500/50' 
                                    : 'border-purple-400' 
                                  : 'border-purple-400'
                              }`}
                              onError={(e) => {
                                e.target.src = getAvatarUrl(user.username.charAt(0).toUpperCase());
                              }}
                            />
                            {/* Online indicator */}
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 animate-pulse ${
                              isInVoiceChat 
                                ? isMuted 
                                  ? 'bg-red-500 shadow-lg shadow-red-500/50' 
                                  : 'bg-purple-400' 
                                : 'bg-green-400'
                            }`}></div>
                            
                            {/* Voice chat mic icon */}
                            {isInVoiceChat && (
                              <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-gray-800 flex items-center justify-center shadow-lg ${
                                isMuted 
                                  ? 'bg-gradient-to-r from-red-500 to-red-600 ring-2 ring-red-400/50' 
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
                              }`}>
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  {isMuted ? (
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14z" clipRule="evenodd" />
                                  ) : (
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                  )}
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Username */}
                          <div className="text-center">
                            <div className={`text-sm font-medium truncate max-w-full ${
                              user.id === socket?.id 
                                ? 'text-purple-300 font-bold' 
                                : isInVoiceChat && isMuted
                                ? 'text-red-300 font-semibold drop-shadow-lg'
                                : isInVoiceChat
                                ? 'text-pink-200 font-semibold'
                                : 'text-white'
                            }`}>
                              {user.username}
                              {user.id === socket?.id && (
                                <span className="block text-xs text-purple-400">(You)</span>
                              )}
                              {isInVoiceChat && user.id !== socket?.id && (
                                <span className="block text-xs text-pink-400">🎤 In Voice</span>
                              )}
                            </div>
                            
                            {/* Host badge */}
                            {roomData?.host === user.id && (
                              <div className="mt-1">
                                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                                  👑 HOST
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Section: Voice Chat and Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Voice Chat */}
              <div>
                <VoiceChat 
                  socket={socket}
                  roomCode={code}
                  username={userProfile.display_name}
                  users={users}
                  isHost={isHost}
                />
              </div>

              {/* Modern Chat */}
              <div className="bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-pink-900/90 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur-sm p-4 border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                        Chat
                      </h3>
                      <p className="text-purple-200 text-sm">
                        {messages.length} message{messages.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Container */}
                <div className="flex flex-col h-80">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent">
                    {messages.length > 0 ? (
                      messages.map((msg, index) => (
                        <div key={msg.id} className="group">
                          <div className={`flex items-start space-x-3 ${msg.username === userProfile.display_name ? 'justify-end' : 'justify-start'}`}>
                            {/* Avatar for other users (left side) */}
                            {msg.username !== userProfile.display_name && (
                              <div className="flex-shrink-0">
                                <img
                                  src={msg.avatar || getAvatarUrl(msg.username.charAt(0).toUpperCase())}
                                  alt={msg.username}
                                  className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm object-cover"
                                  onError={(e) => {
                                    e.target.src = getAvatarUrl(msg.username.charAt(0).toUpperCase());
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Message bubble */}
                            <div className={`max-w-xs lg:max-w-sm px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm border transition-all duration-300 group-hover:shadow-xl ${
                              msg.username === userProfile.display_name
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500/20 shadow-purple-500/20'
                                : 'bg-white/10 text-white border-white/20 shadow-white/10'
                            }`}>
                              {msg.username !== userProfile.display_name && (
                                <div className="text-xs font-medium text-purple-300 mb-1">
                                  {msg.username}
                                </div>
                              )}
                              <div className="text-sm leading-relaxed break-words">
                                {msg.message}
                              </div>
                              <div className={`text-xs mt-1 opacity-70 ${
                                msg.username === userProfile.display_name ? 'text-purple-100' : 'text-gray-300'
                              }`}>
                                {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>

                            {/* Avatar for current user (right side) */}
                            {msg.username === userProfile.display_name && (
                              <div className="flex-shrink-0">
                                <img
                                  src={msg.avatar || userProfile.avatar_url}
                                  alt={userProfile.display_name}
                                  className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm object-cover"
                                  onError={(e) => {
                                    e.target.src = userProfile.avatar_url;
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-6xl mb-4 opacity-50">💬</div>
                        <div className="text-purple-200 text-sm">
                          No messages yet
                        </div>
                        <div className="text-purple-300 text-xs mt-1">
                          Start the conversation!
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="flex space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, sendMessage)}
                          placeholder="Type your message..."
                          maxLength={200}
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-purple-200 text-sm transition-all duration-300 hover:bg-white/15"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-purple-300">
                          {newMessage.length}/200
                        </div>
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="group relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 px-4 py-3 rounded-xl font-medium text-white transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-purple-500/25"
                      >
                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <div className="relative">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Invite Friends Modal */}
        {user && userProfile && (
          <InviteFriends
            roomCode={code}
            roomData={{
              activity: currentVideo ? `Watching: ${currentVideo.title}` : 'Hanging out',
              userCount: users.length
            }}
            isVisible={showInviteFriends}
            onClose={() => setShowInviteFriends(false)}
          />
        )}

        {/* Video Chat Modal (uses same signaling channels as voice chat) */}
        {showVideoChat && (
          <VideoChat
            socket={socket}
            roomCode={code}
            username={userProfile.display_name}
            isVisible={showVideoChat}
            onClose={() => setShowVideoChat(false)}
          />
        )}

        {/* User Context Menu */}
        {contextMenu.show && contextMenu.targetUser && (
          <div
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[180px]"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 100)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-600">
              <div className="flex items-center space-x-2">
                <img
                  src={contextMenu.targetUser.avatar || getAvatarUrl(contextMenu.targetUser.username.charAt(0).toUpperCase())}
                  alt={contextMenu.targetUser.username}
                  className="w-6 h-6 rounded-full border border-purple-400"
                />
                <span className="text-white font-medium text-sm truncate">
                  {contextMenu.targetUser.username}
                </span>
              </div>
            </div>
            <button
              onClick={handleSendFriendRequest}
              disabled={friendRequestLoading}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-600/20 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {friendRequestLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
                  </svg>
                  <span>Add Friend</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}