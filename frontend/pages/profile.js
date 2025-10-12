import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const router = useRouter()
  const { user, userProfile, loading, sessionRestored, uploadAvatar, updateAvatarUrl, updateProfile, signOut } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarMethod, setAvatarMethod] = useState('upload') // 'upload' or 'url'
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  // Initialize display name when userProfile loads
  useEffect(() => {
    if (userProfile?.display_name && !displayName) {
      setDisplayName(userProfile.display_name)
    }
  }, [userProfile, displayName])

  // Redirect if not authenticated
  if (sessionRestored && !loading && !user) {
    router.push('/login')
    return null
  }

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB')
      return
    }

    setIsUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const result = await uploadAvatar(file)
      if (result.success) {
        setUploadSuccess('Avatar updated successfully!')
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setUploadError(result.error?.message || 'Failed to upload avatar')
      }
    } catch (error) {
      setUploadError('Failed to upload avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAvatarUrlUpdate = async () => {
    if (!avatarUrl.trim()) {
      setUploadError('Please enter a valid URL')
      return
    }

    setIsUpdatingAvatar(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const result = await updateAvatarUrl(avatarUrl.trim())
      if (result.success) {
        setUploadSuccess('Avatar updated successfully!')
        setAvatarUrl('')
      } else {
        setUploadError(result.error?.message || 'Failed to update avatar')
      }
    } catch (error) {
      setUploadError('Failed to update avatar')
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    
    if (!displayName.trim()) {
      setProfileError('Display name is required')
      return
    }

    setIsUpdatingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const result = await updateProfile({
        display_name: displayName.trim()
      })

      if (result.error) {
        setProfileError(result.error.message)
      } else {
        setProfileSuccess('Profile updated successfully!')
      }
    } catch (error) {
      setProfileError('Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  return (
    <>
      <Head>
        <title>Profile - Party Player</title>
        <meta name="description" content="Edit your profile - Party Player" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
        {/* Header */}
        <div className="w-full p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/">
              <div className="text-white font-bold text-xl cursor-pointer hover:text-purple-200 transition-colors">
                🎬 Party Player
              </div>
            </Link>
            <div className="flex items-center space-x-4">
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
          <div className="max-w-lg w-full">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
              <h1 className="text-3xl font-bold text-white mb-8 text-center">
                Profile Settings
              </h1>

              {/* Avatar Section */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Profile Picture</h2>
                
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <img
                      src={userProfile.avatar_url}
                      alt={userProfile.display_name}
                      className="w-24 h-24 rounded-full border-4 border-purple-400 object-cover"
                    />
                    {(isUploading || isUpdatingAvatar) && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>

                  {/* Avatar Method Selection */}
                  <div className="w-full">
                    <div className="flex rounded-lg bg-white/10 p-1 mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarMethod('upload')
                          setUploadError('')
                          setUploadSuccess('')
                          setAvatarUrl('')
                        }}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          avatarMethod === 'upload'
                            ? 'bg-purple-600 text-white'
                            : 'text-purple-200 hover:text-white'
                        }`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarMethod('url')
                          setUploadError('')
                          setUploadSuccess('')
                        }}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          avatarMethod === 'url'
                            ? 'bg-purple-600 text-white'
                            : 'text-purple-200 hover:text-white'
                        }`}
                      >
                        Use URL
                      </button>
                    </div>

                    {avatarMethod === 'upload' ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          disabled={isUploading}
                          className="hidden"
                          id="avatar-upload"
                        />
                        <label
                          htmlFor="avatar-upload"
                          className={`block w-full text-center py-2 px-4 rounded-lg border-2 border-dashed border-purple-400 text-purple-200 hover:border-purple-300 hover:text-purple-100 transition-colors cursor-pointer ${
                            isUploading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isUploading ? 'Uploading...' : 'Click to upload new avatar'}
                        </label>
                        <p className="text-sm text-purple-300 mt-2 text-center">
                          Supported formats: JPG, PNG, GIF (max 5MB)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          <input
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://i.imgur.com/example.jpg"
                            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
                            disabled={isUpdatingAvatar}
                          />
                          <button
                            type="button"
                            onClick={handleAvatarUrlUpdate}
                            disabled={isUpdatingAvatar || !avatarUrl.trim()}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                          >
                            {isUpdatingAvatar ? 'Updating...' : 'Update'}
                          </button>
                        </div>
                        <p className="text-sm text-purple-300 text-center">
                          Enter a direct link to an image. Try Imgur, Discord CDN, or any public image URL.
                        </p>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="w-full p-3 bg-red-600/20 border border-red-400 rounded-lg">
                      <p className="text-red-200 text-sm">{uploadError}</p>
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="w-full p-3 bg-green-600/20 border border-green-400 rounded-lg">
                      <p className="text-green-200 text-sm">{uploadSuccess}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-purple-200 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
                    placeholder="Enter your display name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-purple-200 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={userProfile.username}
                    disabled
                    className="w-full px-4 py-3 bg-gray-600/50 border border-gray-500 rounded-lg text-gray-300 cursor-not-allowed"
                  />
                  <p className="text-xs text-purple-300 mt-1">Username cannot be changed</p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={user.email}
                    disabled
                    className="w-full px-4 py-3 bg-gray-600/50 border border-gray-500 rounded-lg text-gray-300 cursor-not-allowed"
                  />
                  <p className="text-xs text-purple-300 mt-1">Email cannot be changed</p>
                </div>

                {profileError && (
                  <div className="p-3 bg-red-600/20 border border-red-400 rounded-lg">
                    <p className="text-red-200 text-sm">{profileError}</p>
                  </div>
                )}

                {profileSuccess && (
                  <div className="p-3 bg-green-600/20 border border-green-400 rounded-lg">
                    <p className="text-green-200 text-sm">{profileSuccess}</p>
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Profile'
                    )}
                  </button>

                  <Link href="/">
                    <button
                      type="button"
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                    >
                      Back to Lobby
                    </button>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}