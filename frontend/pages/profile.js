import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../utils/urls'

export default function Profile() {
  const router = useRouter()
  const {
    user, userProfile, loading, sessionRestored,
    uploadAvatar, updateAvatarUrl, updateProfile, signOut,
  } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [avatarMethod, setAvatarMethod] = useState('upload')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (userProfile?.display_name && !displayName) {
      setDisplayName(userProfile.display_name)
    }
  }, [userProfile, displayName])

  useEffect(() => {
    if (sessionRestored && !loading && !user) router.push('/login')
  }, [user, loading, sessionRestored, router])

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 3500)
  }

  if (loading || !userProfile) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-ink-2 text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    )
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return flash('Please select an image.', true)
    if (file.size > 5 * 1024 * 1024) return flash('Image must be under 5 MB.', true)

    setIsUploading(true)
    try {
      const result = await uploadAvatar(file)
      if (result.success) {
        flash('Avatar updated.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else flash(result.error?.message || 'Upload failed.', true)
    } catch {
      flash('Upload failed.', true)
    } finally { setIsUploading(false) }
  }

  const handleAvatarUrlUpdate = async () => {
    if (!avatarUrl.trim()) return flash('Enter a URL first.', true)
    setIsUpdatingAvatar(true)
    try {
      const result = await updateAvatarUrl(avatarUrl.trim())
      if (result.success) { flash('Avatar updated.'); setAvatarUrl('') }
      else flash(result.error?.message || 'Update failed.', true)
    } catch {
      flash('Update failed.', true)
    } finally { setIsUpdatingAvatar(false) }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) return flash('Display name is required.', true)
    setIsUpdatingProfile(true)
    try {
      const result = await updateProfile({ display_name: displayName.trim() })
      if (result.error) flash(result.error.message, true)
      else flash('Profile updated.')
    } catch {
      flash('Profile update failed.', true)
    } finally { setIsUpdatingProfile(false) }
  }

  const userId = `${userProfile.username}#${userProfile.user_discriminator || '0000'}`

  return (
    <>
      <Head>
        <title>Profile · Party Player</title>
      </Head>

      <div className="page">
        <header className="sticky top-0 z-30 bg-surface-1/90 backdrop-blur border-b border-line">
          <div className="page-shell flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-ghost px-2" aria-label="Home">
                <i className="bi bi-arrow-left text-lg" />
              </Link>
              <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
            </div>
            <button onClick={signOut} className="btn-ghost text-danger">
              <i className="bi bi-box-arrow-right" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="page-shell max-w-3xl">
          {(error || success) && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${error ? 'bg-danger-soft border border-danger/30 text-danger' : 'bg-success-soft border border-success/30 text-success'}`}>
              {error || success}
            </div>
          )}

          {/* Identity card */}
          <div className="surface-card p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-5 mb-4">
            <div className="relative">
              <img
                src={userProfile.avatar_url || getAvatarUrl(userProfile.username)}
                alt={userProfile.display_name}
                className="w-24 h-24 rounded-2xl object-cover border border-line"
              />
              {(isUploading || isUpdatingAvatar) && (
                <div className="absolute inset-0 rounded-2xl bg-surface-1/70 grid place-items-center">
                  <div className="w-6 h-6 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <div className="text-xl font-semibold">{userProfile.display_name}</div>
              <div className="text-sm text-ink-2 font-mono">{userId}</div>
              <button
                onClick={() => { navigator.clipboard.writeText(userId); flash('User ID copied') }}
                className="btn-ghost mt-2 text-xs px-2 py-1"
              >
                <i className="bi bi-clipboard" /> Copy user ID
              </button>
            </div>
          </div>

          {/* Avatar section */}
          <div className="surface-card p-6 mb-4">
            <h2 className="text-sm font-semibold mb-4">Profile picture</h2>

            <div className="flex p-1 gap-1 bg-surface-2 border border-line rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setAvatarMethod('upload')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition
                  ${avatarMethod === 'upload' ? 'bg-surface-3 text-ink-0 border border-line' : 'text-ink-2 hover:text-ink-0'}`}
              >
                <i className="bi bi-upload mr-2" /> Upload file
              </button>
              <button
                type="button"
                onClick={() => setAvatarMethod('url')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition
                  ${avatarMethod === 'url' ? 'bg-surface-3 text-ink-0 border border-line' : 'text-ink-2 hover:text-ink-0'}`}
              >
                <i className="bi bi-link-45deg mr-2" /> From URL
              </button>
            </div>

            {avatarMethod === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="btn-secondary w-full"
                >
                  {isUploading ? 'Uploading…' : 'Choose image'}
                </button>
                <p className="helper">JPG, PNG, or GIF · max 5 MB.</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                  className="input flex-1"
                />
                <button
                  onClick={handleAvatarUrlUpdate}
                  disabled={isUpdatingAvatar || !avatarUrl.trim()}
                  className="btn-primary"
                >
                  {isUpdatingAvatar ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Identity form */}
          <form onSubmit={handleUpdateProfile} className="surface-card p-6 mb-4">
            <h2 className="text-sm font-semibold mb-4">Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  maxLength={50}
                />
                <p className="helper">Shown to others in rooms and chat.</p>
              </div>
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  value={userProfile.username}
                  disabled
                  className="input opacity-60 cursor-not-allowed"
                />
                <p className="helper">Usernames can't be changed.</p>
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="input opacity-60 cursor-not-allowed"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isUpdatingProfile || displayName === userProfile.display_name || !displayName.trim()}
              className="btn-primary mt-5"
            >
              {isUpdatingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          <div className="surface-card p-6">
            <h2 className="text-sm font-semibold mb-2">Account</h2>
            <p className="text-ink-3 text-xs mb-4">Member since {new Date(userProfile.created_at || user.created_at).toLocaleDateString()}</p>
            <button onClick={signOut} className="btn-secondary text-danger">
              <i className="bi bi-box-arrow-right" /> Sign out
            </button>
          </div>
        </main>
      </div>
    </>
  )
}
