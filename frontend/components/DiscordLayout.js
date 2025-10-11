import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { getAvatarUrl } from '../utils/urls'
import RoomInviteNotifications from './RoomInviteNotifications'

export default function DiscordLayout({ children, currentRoom = null }) {
  const { user, userProfile, friends, pendingRequests, sendRoomInvite, signOut } = useAuth()
  const { isConnected, getFilteredOnlineUsers } = useSocket()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showOnlineUsers, setShowOnlineUsers] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  // Get filtered online users (excluding current user and friends)
  const onlineUsers = getFilteredOnlineUsers(friends)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setShowUserMenu(false) // Close menu immediately
      const result = await signOut()
      if (result.error) {
        console.error('Sign out error:', result.error)
        alert('Failed to sign out. Please try again.')
      }
    } catch (error) {
      console.error('Error signing out:', error)
      alert('Failed to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showUserMenu])

  const handleInviteToRoom = async (userId) => {
    if (!currentRoom) {
      alert('No active room to invite to')
      return
    }

    try {
      const result = await sendRoomInvite(userId, currentRoom, { 
        room_name: `Room ${currentRoom}`,
        inviter_name: userProfile.display_name 
      })
      
      if (result.success) {
        alert('Room invite sent!')
      } else {
        alert('Failed to send invite: ' + (result.error?.message || 'Unknown error'))
      }
    } catch (error) {
      alert('Failed to send invite: ' + error.message)
    }
  }

  if (!user || !userProfile) {
    return children // Return children directly if not authenticated
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left Sidebar - Servers/Rooms */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2 border-r border-gray-800">
        {/* Home/Main Server */}
        <Link href="/">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group relative">
            <span className="text-white font-bold text-lg">P</span>
            <div className="absolute left-14 bg-gray-800 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Party Player
            </div>
          </div>
        </Link>
        
        {/* Divider */}
        <div className="w-8 h-0.5 bg-gray-700 rounded"></div>
        
        {/* Add more server icons here in the future */}
        <div className="w-12 h-12 bg-gray-700 rounded-2xl hover:rounded-xl hover:bg-gray-600 transition-all duration-200 flex items-center justify-center cursor-pointer group relative">
          <span className="text-gray-400 text-2xl">+</span>
          <div className="absolute left-14 bg-gray-800 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            Add Server
          </div>
        </div>
      </div>

      {/* Secondary Sidebar - Channels/Friends */}
      <div className="w-60 bg-gray-800 flex flex-col border-r border-gray-700">
        {/* Server Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 shadow-sm">
          <h2 className="font-semibold text-white">Party Player</h2>
          <div className="text-gray-400 hover:text-white cursor-pointer">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Friends Section */}
          <div className="p-2">
            <Link href="/friends">
              <div className={`flex items-center px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer transition-colors ${router.pathname === '/friends' ? 'bg-gray-700 text-white' : 'text-gray-300'}`}>
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM5 7a2 2 0 11-4 0 2 2 0 014 0zM19 7a2 2 0 11-4 0 2 2 0 014 0zM17 11H3a3 3 0 00-3 3v3a1 1 0 001 1h1a1 1 0 001-1v-3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 001 1h1a1 1 0 001-1v-3a3 3 0 00-3-3z" />
                </svg>
                Friends
                {pendingRequests.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Voice Channels Section */}
          <div className="px-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Voice Channels</h3>
            </div>
            
            {/* General Voice Channel */}
            <div className="space-y-1">
              <Link href="/voice/general">
                <div className="flex items-center px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer transition-colors text-gray-300">
                  <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  General
                </div>
              </Link>
            </div>
          </div>

          {/* Text Channels Section */}
          <div className="px-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text Channels</h3>
            </div>
            
            <div className="space-y-1">
              <Link href="/chat/general">
                <div className="flex items-center px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer transition-colors text-gray-300">
                  <span className="mr-3 text-gray-400">#</span>
                  general
                </div>
              </Link>
              
              <Link href="/chat/watch-party">
                <div className="flex items-center px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer transition-colors text-gray-300">
                  <span className="mr-3 text-gray-400">#</span>
                  watch-party
                </div>
              </Link>
            </div>
          </div>

          {/* Friends List */}
          <div className="px-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Online Friends</h3>
              {friends.filter(friend => friend.is_online).length > 0 && (
                <span className="text-xs text-gray-500">
                  {friends.filter(friend => friend.is_online).length}
                </span>
              )}
            </div>
            
            <div className="space-y-1">
              {friends.filter(friend => friend.is_online).slice(0, 8).map((friend) => (
                <div key={friend.id} className="group flex items-center px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors">
                  <div className="relative mr-2">
                    <img
                      src={friend.avatar_url || getAvatarUrl(friend.username)}
                      alt={friend.display_name}
                      className="w-6 h-6 rounded-full"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                  </div>
                  <span className="flex-1 truncate">{friend.display_name}</span>
                  {currentRoom && (
                    <button
                      onClick={() => handleInviteToRoom(friend.id)}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-all"
                      title="Invite to room"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Online Users Section */}
          <div className="px-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Online Users
              </h3>
              <button
                onClick={() => setShowOnlineUsers(!showOnlineUsers)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg 
                  className={`w-3 h-3 transform transition-transform ${showOnlineUsers ? 'rotate-180' : ''}`} 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {showOnlineUsers && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {onlineUsers && onlineUsers.length > 0 ? (
                  onlineUsers.slice(0, 10).map((onlineUser) => (
                    <div key={onlineUser.id} className="group flex items-center px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors">
                      <div className="relative mr-2">
                        <img
                          src={onlineUser.avatar_url || getAvatarUrl(onlineUser.username)}
                          alt={onlineUser.display_name}
                          className="w-6 h-6 rounded-full"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                      </div>
                      <span className="flex-1 truncate">{onlineUser.display_name}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                        {currentRoom && (
                          <button
                            onClick={() => handleInviteToRoom(onlineUser.id)}
                            className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-all"
                            title="Invite to room"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                          </button>
                        )}
                        <Link href="/friends">
                          <button
                            className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-all"
                            title="Add friend"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 px-2 py-2">
                    No other users online
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Area */}
        <div className="h-14 bg-gray-900 border-t border-gray-700 flex items-center px-2 user-menu-container relative">
          <div className="flex items-center flex-1 min-w-0">
            <div className="relative mr-2">
              <img
                src={userProfile.avatar_url || getAvatarUrl(userProfile.username)}
                alt={userProfile.display_name}
                className="w-8 h-8 rounded-full"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{userProfile.display_name}</div>
              <div className="text-xs text-gray-400 truncate">
                {userProfile.username}#{userProfile.user_discriminator || '0000'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Mute button */}
            <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Deafen button */}
            <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.061l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
              </svg>
            </button>
            
            {/* Settings button */}
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* User menu dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-16 right-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-48">
              <div className="p-2">
                <Link href="/profile">
                  <div className="flex items-center px-2 py-2 hover:bg-gray-700 rounded cursor-pointer">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Profile
                  </div>
                </Link>
                <div className="border-t border-gray-600 my-1"></div>
                <button 
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center px-2 py-2 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-red-400 hover:text-white disabled:text-gray-500 transition-colors"
                >
                  {isSigningOut ? (
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
                  ) : (
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293-2.293a1 1 0 10-1.414 1.414L14.586 5H4a3 3 0 100 6h10.586l-2.293 2.293a1 1 0 101.414 1.414L16.414 11H4a1 1 0 000 2h12.586l-2.293 2.293a1 1 0 101.414 1.414L18.414 13H4a3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>

      {/* Room Invite Notifications */}
      <RoomInviteNotifications />
    </div>
  )
}