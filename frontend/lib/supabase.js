import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Auth helper functions
export const auth = {
  // Sign up new user
  signUp: async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  // Sign in user
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out user
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  }
}

// Database helper functions
export const db = {
  // User operations
  users: {
    // Create user profile
    create: async (userId, userData) => {
      const { data, error } = await supabase
        .from('users')
        .insert([{ id: userId, ...userData }])
        .select()
      return { data, error }
    },

    // Get user by ID
    getById: async (userId) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      return { data, error }
    },

    // Get user by username
    getByUsername: async (username) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single()
      return { data, error }
    },

    // Get user by special ID (username#discriminator)
    getBySpecialId: async (specialId) => {
      const { data, error } = await supabase
        .rpc('get_user_by_special_id', { special_id: specialId })
      
      // Handle case where user_discriminator might be null
      let user = data?.[0] || null
      if (user && !user.user_discriminator) {
        user.user_discriminator = '0000' // Default fallback
      }
      
      return { data: user, error }
    },

    // Generate discriminator for username
    generateDiscriminator: async (username) => {
      const { data, error } = await supabase
        .rpc('generate_discriminator', { target_username: username })
      return { data, error }
    },

    // Migrate existing users without discriminators
    migrateExistingUsers: async () => {
      const { data, error } = await supabase
        .rpc('migrate_existing_users')
      return { data, error }
    },

    // Get all users (for debugging)
    getAll: async () => {
      try {
        console.log('🔍 DB: Getting sample users...')
        
        // First try with user_discriminator column
        let { data, error } = await supabase
          .from('users')
          .select('id, username, user_discriminator, display_name, avatar_url, is_online')
          .limit(10)
        
        // If error (possibly missing column), try without user_discriminator
        if (error && error.message.includes('user_discriminator')) {
          console.log('🔍 DB: user_discriminator column not found, trying without it')
          const fallbackResult = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url, is_online')
            .limit(10)
          
          data = fallbackResult.data
          error = fallbackResult.error
          
          // Add fallback discriminator
          if (data) {
            data.forEach(user => {
              user.user_discriminator = '0000'
            })
          }
        }
        
        console.log('🔍 DB: Sample users result:', { data, error })
        return { data, error }
      } catch (err) {
        console.error('🔍 DB: Sample users error:', err)
        return { data: null, error: err }
      }
    },

    // Test database connection
    testConnection: async () => {
      try {
        console.log('🔍 DB: Testing connection...')
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .limit(1)
        
        console.log('🔍 DB: Connection test result:', { data, error })
        return { data: { connected: !error, userCount: data?.length || 0 }, error }
      } catch (err) {
        console.error('🔍 DB: Connection test error:', err)
        return { data: null, error: err }
      }
    },

    // Update user
    update: async (userId, updates) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
      return { data, error }
    },

    // Search users by username
    search: async (searchTerm) => {
      try {
        // First try with user_discriminator column
        let { data, error } = await supabase
          .from('users')
          .select('id, username, user_discriminator, display_name, avatar_url, is_online')
          .ilike('username', `%${searchTerm}%`)
          .limit(10)
        
        // If error (possibly missing column), try without user_discriminator
        if (error && (error.message.includes('user_discriminator') || error.message.includes('column'))) {
          const fallbackResult = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url, is_online')
            .ilike('username', `%${searchTerm}%`)
            .limit(10)
          
          data = fallbackResult.data
          error = fallbackResult.error
        }
        
        // Handle users without discriminators (for backward compatibility)
        if (data) {
          data.forEach(user => {
            if (!user.user_discriminator) {
              user.user_discriminator = '0000' // Default fallback
            }
          })
        }
        
        return { data, error }
      } catch (err) {
        console.error('Search function error:', err)
        return { data: null, error: err }
      }
    },

    // Get all online users
    getOnlineUsers: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, is_online, last_seen')
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(50)
      return { data, error }
    },

    // Get users that are not friends yet (for suggestions)
    getNotFriends: async (userId) => {
      const { data, error } = await supabase
        .rpc('get_non_friends', { current_user_id: userId })
      return { data, error }
    },

    // Upload avatar and update user profile
    uploadAvatar: async (userId, file) => {
      try {
        // Create unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${userId}-${Date.now()}.${fileExt}`
        const filePath = fileName // Just the filename, not nested in a folder

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          return { error: uploadError }
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        // Update user's avatar_url in database
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({ avatar_url: publicUrl })
          .eq('id', userId)
          .select()

        if (updateError) {
          console.error('Database update error:', updateError)
          return { error: updateError }
        }

        return { data: { avatarUrl: publicUrl, user: updateData[0] }, error: null }
      } catch (error) {
        console.error('Avatar upload error:', error)
        return { error }
      }
    },

    // Update avatar URL directly
    updateAvatarUrl: async (userId, avatarUrl) => {
      try {
        // Validate URL format
        try {
          new URL(avatarUrl)
        } catch {
          return { error: { message: 'Invalid URL format' } }
        }

        // Update user's avatar_url in database
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', userId)
          .select()

        if (updateError) {
          console.error('Database update error:', updateError)
          return { error: updateError }
        }

        return { data: { avatarUrl: avatarUrl, user: updateData[0] }, error: null }
      } catch (error) {
        console.error('Avatar URL update error:', error)
        return { error }
      }
    }
  },

  // Friend operations
  friends: {
    // Send friend request
    sendRequest: async (fromUserId, toUserId) => {
      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`)
        .maybeSingle()

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return { error: { message: 'Friend request already sent' } }
        } else if (existingRequest.status === 'accepted') {
          return { error: { message: 'Already friends with this user' } }
        }
      }

      // Check if already friends
      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user1_id.eq.${fromUserId},user2_id.eq.${toUserId}),and(user1_id.eq.${toUserId},user2_id.eq.${fromUserId})`)
        .maybeSingle()

      if (friendship) {
        return { error: { message: 'Already friends with this user' } }
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .insert([{
          from_user_id: fromUserId,
          to_user_id: toUserId,
          status: 'pending'
        }])
        .select()
      return { data, error }
    },

    // Accept friend request
    acceptRequest: async (requestId) => {
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .select('from_user_id, to_user_id')
        .eq('id', requestId)
        .single()

      if (requestError) return { error: requestError }

      // Update request status
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (updateError) return { error: updateError }

      // Create friendship record using the proper function
      const { data, error } = await supabase.rpc('create_friendship', {
        user1: request.from_user_id,
        user2: request.to_user_id
      })

      return { data, error }
    },

    // Reject friend request
    rejectRequest: async (requestId) => {
      const { data, error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .select()
      return { data, error }
    },

    // Get user's friends
    getFriends: async (userId) => {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          user1:users!friendships_user1_id_fkey(id, username, display_name, avatar_url, is_online),
          user2:users!friendships_user2_id_fkey(id, username, display_name, avatar_url, is_online)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

      if (error) return { error }

      // Format friends data
      const friends = data.map(friendship => {
        const friend = friendship.user1_id === userId ? friendship.user2 : friendship.user1
        return {
          friendship_id: friendship.id,
          ...friend,
          friendship_created_at: friendship.created_at
        }
      })

      return { data: friends, error: null }
    },

    // Get pending friend requests
    getPendingRequests: async (userId) => {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          to_user_id,
          created_at,
          from_user:users!friend_requests_from_user_id_fkey(id, username, display_name, avatar_url),
          to_user:users!friend_requests_to_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('to_user_id', userId)
        .eq('status', 'pending')

      return { data, error }
    },

    // Remove friend
    removeFriend: async (friendshipId) => {
      const { data, error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .select()
      return { data, error }
    }
  },

  // Room invites
  invites: {
    // Send room invite to friend
    sendInvite: async (fromUserId, toUserId, roomCode, roomData) => {
      const { data, error } = await supabase
        .from('room_invites')
        .insert([{
          from_user_id: fromUserId,
          to_user_id: toUserId,
          room_code: roomCode,
          room_data: roomData,
          status: 'pending'
        }])
        .select()
      return { data, error }
    },

    // Get user's pending invites
    getPendingInvites: async (userId) => {
      const { data, error } = await supabase
        .from('room_invites')
        .select(`
          id,
          room_code,
          room_data,
          created_at,
          from_user:users!room_invites_from_user_id_fkey(username, display_name, avatar_url)
        `)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      return { data, error }
    },

    // Accept room invite
    acceptInvite: async (inviteId) => {
      const { data, error } = await supabase
        .from('room_invites')
        .update({ status: 'accepted' })
        .eq('id', inviteId)
        .select()
      return { data, error }
    },

    // Reject room invite
    rejectInvite: async (inviteId) => {
      const { data, error } = await supabase
        .from('room_invites')
        .update({ status: 'rejected' })
        .eq('id', inviteId)
        .select()
      return { data, error }
    }
  }
}

export default supabase