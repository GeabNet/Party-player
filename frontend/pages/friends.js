import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { getAvatarUrl } from '../utils/urls'
import { db } from '../lib/supabase'

export default function Friends() {
  const { user, userProfile, friends, pendingRequests, pendingInvites, sendFriendRequest, sendFriendRequestBySpecialId, acceptFriendRequest, rejectFriendRequest, removeFriend, acceptRoomInvite, rejectRoomInvite, refreshUserData, loading, sessionRestored } = useAuth()
  const { isConnected, getFilteredOnlineUsers, refreshOnlineUsers } = useSocket()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingState, setLoadingState] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('friends')
  const [sendingRequestTo, setSendingRequestTo] = useState(null)
  const router = useRouter()

  // Get filtered online users (excluding current user and friends)
  const onlineUsers = getFilteredOnlineUsers(friends)

  useEffect(() => {
    if (sessionRestored && !loading && !user) {
      router.push('/login')
    }
  }, [user, loading, sessionRestored, router])

  useEffect(() => {
    if (user) {
      refreshUserData()
    }
  }, [user, refreshUserData])

  // Search for users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([])
        return
      }

      if (searchTerm.length < 2) {
        return
      }

      setSearchLoading(true)
      setError('') // Clear previous errors
      
      try {
        let data, error

        // Check if search term is a special ID (contains #)
        if (searchTerm.includes('#') && /^.+#\d{4}$/.test(searchTerm)) {
          // Search by special ID
          const result = await db.users.getBySpecialId(searchTerm)
          data = result.data ? [result.data] : []
          error = result.error
        } else {
          // Regular username search
          const result = await db.users.search(searchTerm)
          data = result.data
          error = result.error
        }

        if (error) {
          console.error('Search error:', error)
          setSearchResults([])
          setError(`Search failed: ${error.message}`)
        } else {
          // Filter out current user and existing friends
          const filteredResults = data?.filter(user => {
            if (user.id === userProfile?.id) return false
            // Check if user is already a friend
            if (friends?.some(friend => friend.id === user.id)) return false
            // Check pending requests
            if (pendingRequests?.some(req => req.from_user.id === user.id || req.to_user.id === user.id)) return false
            return true
          }) || []
          
          setSearchResults(filteredResults)
        }
      } catch (err) {
        console.error('Search exception:', err)
        setSearchResults([])
        setError(`Search failed: ${err.message}`)
      } finally {
        setSearchLoading(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchTerm, userProfile, friends, pendingRequests])

  const handleSendFriendRequest = async (targetUser) => {
    if (!targetUser || !targetUser.id) {
      setError('Invalid user selected')
      return
    }

    setSendingRequestTo(targetUser.id)
    setError('')
    setSuccess('')

    const result = await sendFriendRequest(targetUser.id)
    
    if (result && result.error) {
      setError(result.error.message)
    } else if (result && result.success) {
      setSuccess(`Friend request sent to ${targetUser.display_name}`)
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== targetUser.id))
    } else {
      // Assume success if no error
      setSuccess(`Friend request sent to ${targetUser.display_name}`)
      setSearchResults(prev => prev.filter(user => user.id !== targetUser.id))
    }
    
    setSendingRequestTo(null)
  }

  const handleAcceptRequest = async (requestId) => {
    const { error } = await acceptFriendRequest(requestId)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Friend request accepted!')
    }
  }

  const handleRejectRequest = async (requestId) => {
    const { error } = await rejectFriendRequest(requestId)
    if (error) {
      setError(error.message)
    }
  }

  const handleRemoveFriend = async (friendshipId, friendName) => {
    if (confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
      const { error } = await removeFriend(friendshipId)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(`Removed ${friendName} from friends`)
      }
    }
  }

  const handleAcceptInvite = async (inviteId, roomCode) => {
    const { error } = await acceptRoomInvite(inviteId)
    if (error) {
      setError(error.message)
    } else {
      // Navigate to room
      router.push(`/r/${roomCode}?username=${encodeURIComponent(userProfile.display_name)}&avatar=${encodeURIComponent(userProfile.avatar_url)}`)
    }
  }

  const handleRejectInvite = async (inviteId) => {
    const { error } = await rejectRoomInvite(inviteId)
    if (error) {
      setError(error.message)
    }
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Friends - Party Player</title>
      </Head>
      
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="text-gray-400 hover:text-white transition-colors">
                  ← Back to Home
                </button>
              </Link>
              <h1 className="text-2xl font-bold">Friends</h1>
            </div>
            <div className="flex items-center space-x-2">
              <img
                src={userProfile.avatar_url}
                alt={userProfile.display_name}
                className="w-8 h-8 rounded-full border-2 border-purple-400"
              />
              <span className="font-medium">{userProfile.display_name}</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-6">
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          )}

          {/* Add Friend Section */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Add Friend</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by username or User ID (e.g., john#1234)..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* Search Results */}
              {searchTerm && (
                <div className="space-y-2">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                      <span className="ml-2 text-gray-400">Searching for &quot;{searchTerm}&quot;...</span>
                    </div>
                  ) : error ? (
                    <div className="bg-red-900/50 border border-red-600 rounded-lg p-3">
                      <p className="text-red-400 text-sm">❌ {error}</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}:</p>
                      {searchResults.map((user) => (
                        <div key={user.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <img
                              src={user.avatar_url}
                              alt={user.display_name}
                              className="w-10 h-10 rounded-full border-2 border-gray-600"
                            />
                            <div>
                              <p className="font-medium">{user.display_name}</p>
                              <p className="text-sm text-gray-400">
                                {user.username}#{user.user_discriminator || '0000'}
                              </p>
                            </div>
                            {user.is_online && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(user)}
                            disabled={sendingRequestTo === user.id}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            {sendingRequestTo === user.id ? 'Sending...' : 'Send Request'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : searchTerm.length >= 2 ? (
                    <p className="text-gray-400 text-center py-4">No users found matching &quot;{searchTerm}&quot;</p>
                  ) : (
                    <p className="text-gray-400 text-center py-2">Type at least 2 characters to search</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Your User ID Section */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-2">Your User ID</h3>
            <div className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <img
                  src={userProfile.avatar_url || getAvatarUrl(userProfile.username)}
                  alt={userProfile.display_name}
                  className="w-10 h-10 rounded-full border-2 border-gray-600"
                />
                <div>
                  <p className="font-medium">{userProfile.display_name}</p>
                  <p className="text-sm text-gray-400">
                    {userProfile.username}#{userProfile.user_discriminator || '0000'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const specialId = `${userProfile.username}#${userProfile.user_discriminator || '0000'}`
                  navigator.clipboard.writeText(specialId)
                  setSuccess('User ID copied to clipboard!')
                  setTimeout(() => setSuccess(''), 3000)
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Copy User ID"
              >
                Copy ID
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share your User ID with friends so they can send you friend requests directly!
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'friends' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('online')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'online' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Online Users ({onlineUsers?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'requests' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Pending Requests ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'invites' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Room Invites ({pendingInvites.length})
            </button>
          </div>

          {/* Friends List */}
          {activeTab === 'friends' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Your Friends</h2>
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-gray-500 text-sm mt-2">Send friend requests to connect with others!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {friends.map((friend) => (
                    <div key={friend.friendship_id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={friend.avatar_url || getAvatarUrl(friend.username)}
                            alt={friend.display_name}
                            className="w-12 h-12 rounded-full border-2 border-purple-400"
                          />
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-700 ${friend.is_online ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        </div>
                        <div>
                          <p className="font-medium">{friend.display_name}</p>
                          <p className="text-sm text-gray-400">@{friend.username}</p>
                          <p className="text-xs text-gray-500">{friend.is_online ? 'Online' : 'Offline'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendship_id, friend.display_name)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Online Users */}
          {activeTab === 'online' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Online Users</h2>
              {!onlineUsers || onlineUsers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-gray-400">No other users online</p>
                  <button
                    onClick={refreshOnlineUsers}
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-sm">
                      {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online
                    </p>
                    <button
                      onClick={refreshOnlineUsers}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                  {onlineUsers.map((onlineUser) => (
                    <div key={onlineUser.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={onlineUser.avatar_url || getAvatarUrl(onlineUser.username)}
                            alt={onlineUser.display_name}
                            className="w-12 h-12 rounded-full border-2 border-gray-600"
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-700"></div>
                        </div>
                        <div>
                          <p className="font-medium">{onlineUser.display_name}</p>
                          <p className="text-sm text-gray-400">
                            {onlineUser.username}#{onlineUser.user_discriminator || '0000'}
                          </p>
                          <p className="text-xs text-green-400">Online</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFriendRequest(onlineUser)}
                        disabled={sendingRequestTo === onlineUser.id}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        {sendingRequestTo === onlineUser.id ? 'Sending...' : 'Add Friend'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Requests */}
          {activeTab === 'requests' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Pending Friend Requests</h2>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📬</div>
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={request.from_user.avatar_url || getAvatarUrl(request.from_user.username)}
                          alt={request.from_user.display_name}
                          className="w-12 h-12 rounded-full border-2 border-purple-400"
                        />
                        <div>
                          <p className="font-medium">{request.from_user.display_name}</p>
                          <p className="text-sm text-gray-400">
                            {request.from_user.username}#{request.from_user.user_discriminator || '0000'}
                          </p>
                          <p className="text-xs text-gray-500">Sent {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Room Invites */}
          {activeTab === 'invites' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Room Invites</h2>
              {pendingInvites.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎬</div>
                  <p className="text-gray-400">No room invites</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <img
                            src={invite.from_user.avatar_url || getAvatarUrl(invite.from_user.username)}
                            alt={invite.from_user.display_name}
                            className="w-10 h-10 rounded-full border-2 border-purple-400"
                          />
                          <div>
                            <p className="font-medium">{invite.from_user.display_name} invited you to a room</p>
                            <p className="text-sm text-gray-400">Room Code: {invite.room_code}</p>
                            <p className="text-xs text-gray-500">Invited {new Date(invite.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptInvite(invite.id, invite.room_code)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
                          >
                            Join Room
                          </button>
                          <button
                            onClick={() => handleRejectInvite(invite.id)}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                      {invite.room_data && (
                        <div className="bg-gray-600 rounded p-3 text-sm">
                          <p className="text-gray-300">Current activity: {invite.room_data.activity || 'Watching together'}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}