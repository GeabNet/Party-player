import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ServerStatus from '../components/ServerStatus';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../utils/urls';

/**
 * Landing page - requires authentication
 * Provides the main entry point to the watch party application
 */
export default function Home() {
  const { user, userProfile, signOut, loading, sessionRestored } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    // Only redirect after session restoration is complete and no user is found
    if (sessionRestored && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, sessionRestored, router]);

  /**
   * Create a new room
   */
  const createRoom = async () => {
    if (!user || !profile) {
      setError('You must be logged in to create a room');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.roomCode) {
        // Navigate to the room with user data
        const params = new URLSearchParams({
          username: profile.display_name,
          avatar: encodeURIComponent(profile.avatar_url)
        });
        router.push(`/r/${data.roomCode}?${params.toString()}`);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Join an existing room
   */
  const joinRoom = async () => {
    if (!user || !profile) {
      setError('You must be logged in to join a room');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setError('');

    try {
      // Validate room exists
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/room/${roomCode.toUpperCase()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          // Navigate to the room with user data
          const params = new URLSearchParams({
            username: profile.display_name,
            avatar: encodeURIComponent(profile.avatar_url)
          });
          router.push(`/r/${roomCode.toUpperCase()}?${params.toString()}`);
        } else {
          setError('Room not found. Please check the room code.');
        }
      } else {
        setError('Room not found. Please check the room code.');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please check your connection.');
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  // Show loading while checking authentication or loading profile
  if (loading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{!user ? 'Loading...' : 'Loading your profile...'}</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return null;
  }

  // Fallback profile if userProfile is still loading
  const profile = userProfile || {
    display_name: user.email?.split('@')[0] || 'User',
    username: user.email?.split('@')[0] || 'user',
    avatar_url: getAvatarUrl(user.email?.charAt(0).toUpperCase() || 'U')
  };

  return (
    <>
      <Head>
        <title>Watch Party - Synchronized YouTube Viewing</title>
        <meta name="description" content="Create or join watch parties to enjoy YouTube videos together in perfect sync" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
        <ServerStatus />
        
        {/* Header */}
        <div className="w-full p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="text-white font-bold text-xl">
              🎬 Party Player
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/profile">
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 rounded-lg p-2 transition-colors">
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-8 h-8 rounded-full border-2 border-purple-400"
                  />
                  <span className="text-white font-medium">{profile.display_name}</span>
                </div>
              </Link>
              <Link href="/friends">
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                  Friends
                </button>
              </Link>
              <button
                onClick={signOut}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full space-y-8">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                🎬 Watch Party
              </h1>
              <p className="text-purple-200 text-lg">
                Watch YouTube videos together in perfect sync
              </p>
            </div>

            {/* User Welcome */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
              <div className="flex items-center space-x-4 mb-6">
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-16 h-16 rounded-2xl border-3 border-purple-400 shadow-lg"
                />
                <div>
                  <h3 className="text-white font-bold text-lg">Welcome back, {profile.display_name}!</h3>
                  <p className="text-purple-200 text-sm">@{profile.username}</p>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Create Room */}
                <button
                  onClick={createRoom}
                  disabled={isCreating}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-2xl hover:shadow-purple-500/25"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="relative flex items-center justify-center space-x-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>{isCreating ? 'Creating Room...' : 'Create New Room'}</span>
                  </div>
                </button>

                {/* Join Room */}
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => handleKeyPress(e, joinRoom)}
                      placeholder="Enter room code (e.g., ABC123)"
                      maxLength={6}
                      className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-purple-200 text-center text-lg font-bold tracking-wider focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 hover:bg-white/15"
                    />
                  </div>
                  <button
                    onClick={joinRoom}
                    disabled={!roomCode.trim()}
                    className="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-2xl hover:shadow-indigo-500/25"
                  >
                    <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    <div className="relative flex items-center justify-center space-x-3">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Join Room</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="text-center space-y-2">
              <div className="text-purple-200 text-sm">
                ✨ Synchronized video playback • 💬 Real-time chat • 👥 Friend system
              </div>
              <div className="text-purple-300 text-xs">
                Invite friends and watch together!
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}