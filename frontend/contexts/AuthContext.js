import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, auth, db } from '../lib/supabase'
import { getAvatarUrl } from '../utils/urls'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionRestored, setSessionRestored] = useState(false)
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const router = useRouter()

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            await loadUserProfile(session.user.id)
            await loadUserData(session.user.id)
          } else {
            setUser(null)
            setUserProfile(null)
            setFriends([])
            setPendingRequests([])
            setPendingInvites([])
          }
          setSessionRestored(true)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setSessionRestored(true)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, session)
      
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user)
        await loadUserProfile(session.user.id)
        await loadUserData(session.user.id)
      } else {
        setUser(null)
        setUserProfile(null)
        setFriends([])
        setPendingRequests([])
        setPendingInvites([])
      }
      
      setLoading(false)
    })

    return () => {
      mounted = false;
      subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId) => {
    try {
      console.log('Loading user profile for:', userId)
      const { data, error } = await db.users.getById(userId)
      
      if (error) {
        console.error('Error loading user profile:', error)
        
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
          console.log('User profile not found, creating new profile...')
          const { user } = await auth.getUser()
          if (user) {
            const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user'
            const displayName = user.user_metadata?.display_name || username
            
            const { data: newProfile, error: createError } = await db.users.create(userId, {
              username,
              display_name: displayName,
              avatar_url: getAvatarUrl(username)
            })
            
            if (createError) {
              console.error('Error creating user profile:', createError)
              return
            }
            
            console.log('Created new user profile:', newProfile)
            setUserProfile(newProfile[0])
            return
          }
        }
        return
      }
      
      console.log('Loaded user profile:', data)
      setUserProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const loadUserData = async (userId) => {
    try {
      // Load friends
      const { data: friendsData, error: friendsError } = await db.friends.getFriends(userId)
      if (!friendsError && friendsData) {
        setFriends(friendsData)
      }

      // Load pending friend requests
      const { data: requestsData, error: requestsError } = await db.friends.getPendingRequests(userId)
      if (!requestsError && requestsData) {
        setPendingRequests(requestsData)
      }

      // Load pending room invites
      const { data: invitesData, error: invitesError } = await db.invites.getPendingInvites(userId)
      if (!invitesError && invitesData) {
        setPendingInvites(invitesData)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const signUp = async (email, password, username, displayName) => {
    try {
      setLoading(true)
      
      // Check if username is available
      const { data: existingUser } = await db.users.getByUsername(username)
      if (existingUser) {
        return { error: { message: 'Username is already taken' } }
      }

      // Generate discriminator for unique ID
      const { data: discriminator, error: discError } = await db.users.generateDiscriminator(username)
      if (discError) {
        console.error('Error generating discriminator:', discError)
        return { error: { message: 'Error generating user ID' } }
      }

      // Sign up with Supabase Auth
      const { data, error } = await auth.signUp(email, password, {
        username,
        display_name: displayName
      })

      if (error) return { error }

      // Create user profile with discriminator
      if (data.user) {
        const { error: profileError } = await db.users.create(data.user.id, {
          username,
          user_discriminator: discriminator,
          display_name: displayName,
          avatar_url: getAvatarUrl(username)
        })

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      }

      return { data, error: null }
    } catch (error) {
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await auth.signIn(email, password)
      return { data, error }
    } catch (error) {
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      // Sign out from Supabase
      const { error } = await auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        throw error
      }
      
      // Clear all state
      setUser(null)
      setUserProfile(null)
      setFriends([])
      setPendingRequests([])
      setPendingInvites([])
      
      // Redirect to login page
      router.push('/login')
      
      return { success: true }
    } catch (error) {
      console.error('signOut error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    try {
      if (!user?.id) return { error: { message: 'No user logged in' } }
      
      const { data, error } = await db.users.update(user.id, updates)
      if (!error && data) {
        setUserProfile(data[0])
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  // Friend management functions
  const sendFriendRequest = async (toUsernameOrId) => {
    try {
      if (!user?.id) return { error: { message: 'Not authenticated' } }

      let targetUser = null;
      
      // Check if the parameter looks like a UUID (user ID) or username
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(toUsernameOrId);
      
      if (isUUID) {
        // Find user by ID
        const { data, error: userError } = await db.users.getById(toUsernameOrId)
        if (userError || !data) {
          return { error: { message: 'User not found' } }
        }
        targetUser = data;
      } else {
        // Find user by username
        const { data, error: userError } = await db.users.getByUsername(toUsernameOrId)
        if (userError || !data) {
          return { error: { message: 'User not found' } }
        }
        targetUser = data;
      }

      if (targetUser.id === user.id) {
        return { error: { message: 'Cannot send friend request to yourself' } }
      }

      // Check if already friends or request exists
      const existingFriends = friends.find(f => f.id === targetUser.id)
      if (existingFriends) {
        return { error: { message: 'Already friends with this user' } }
      }

      const result = await db.friends.sendRequest(user.id, targetUser.id)
      if (result && !result.error) {
        // Refresh pending requests
        await loadUserData(user.id)
        return { success: true, data: result.data }
      }
      return result
    } catch (error) {
      console.error('sendFriendRequest error:', error)
      return { error: { message: error.message || 'Failed to send friend request' } }
    }
  }

  const sendFriendRequestBySpecialId = async (specialId) => {
    try {
      if (!user?.id) {
        return { error: { message: 'Not authenticated' } }
      }

      // Validate special ID format (username#0000)
      if (!specialId.includes('#') || !/^.+#\d{4}$/.test(specialId)) {
        return { error: { message: 'Invalid user ID format. Use username#0000' } }
      }

      // Find user by special ID
      const { data: targetUser, error: userError } = await db.users.getBySpecialId(specialId)
      if (userError || !targetUser) {
        return { error: { message: 'User not found' } }
      }

      if (targetUser.id === user.id) {
        return { error: { message: 'Cannot send friend request to yourself' } }
      }

      // Check if already friends or request exists
      const existingFriends = friends.find(f => f.id === targetUser.id)
      if (existingFriends) {
        return { error: { message: 'Already friends with this user' } }
      }

      const result = await db.friends.sendRequest(user.id, targetUser.id)
      if (result && !result.error) {
        // Refresh pending requests
        await loadUserData(user.id)
        return { success: true, data: result.data, targetUser }
      }
      return result
    } catch (error) {
      console.error('sendFriendRequestBySpecialId error:', error)
      return { error: { message: error.message || 'Failed to send friend request' } }
    }
  }

  const acceptFriendRequest = async (requestId) => {
    try {
      const { data, error } = await db.friends.acceptRequest(requestId)
      if (!error) {
        // Refresh user data
        await loadUserData(user.id)
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  const rejectFriendRequest = async (requestId) => {
    try {
      const { data, error } = await db.friends.rejectRequest(requestId)
      if (!error) {
        // Refresh pending requests
        await loadUserData(user.id)
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  const removeFriend = async (friendshipId) => {
    try {
      const { data, error } = await db.friends.removeFriend(friendshipId)
      if (!error) {
        // Refresh user data
        await loadUserData(user.id)
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  const sendRoomInvite = async (toUserId, roomCode, roomData = {}) => {
    try {
      if (!user?.id) {
        return { error: { message: 'Not authenticated' } }
      }

      const { data, error } = await db.invites.sendInvite(user.id, toUserId, roomCode, roomData)
      if (!error) {
        return { success: true, data }
      }
      return { error }
    } catch (error) {
      console.error('sendRoomInvite error:', error)
      return { error: { message: error.message || 'Failed to send room invite' } }
    }
  }

  const acceptRoomInvite = async (inviteId) => {
    try {
      const { data, error } = await db.invites.acceptInvite(inviteId)
      if (!error) {
        // Refresh pending invites
        await loadUserData(user.id)
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  const rejectRoomInvite = async (inviteId) => {
    try {
      const { data, error } = await db.invites.rejectInvite(inviteId)
      if (!error) {
        // Refresh pending invites
        await loadUserData(user.id)
      }
      return { data, error }
    } catch (error) {
      return { error }
    }
  }

  const uploadAvatar = async (file) => {
    try {
      if (!user?.id) return { error: { message: 'Not authenticated' } }

      const result = await db.users.uploadAvatar(user.id, file)
      if (result && !result.error) {
        // Update the local user profile
        setUserProfile(prev => ({
          ...prev,
          avatar_url: result.data.avatarUrl
        }))
        return { success: true, data: result.data }
      }
      return result
    } catch (error) {
      console.error('uploadAvatar error:', error)
      return { error: { message: error.message || 'Failed to upload avatar' } }
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    sessionRestored,
    friends,
    pendingRequests,
    pendingInvites,
    signUp,
    signIn,
    signOut,
    updateProfile,
    uploadAvatar,
    sendFriendRequest,
    sendFriendRequestBySpecialId,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    sendRoomInvite,
    acceptRoomInvite,
    rejectRoomInvite,
    refreshUserData: () => user?.id && loadUserData(user.id)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider