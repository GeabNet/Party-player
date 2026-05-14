import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { getAvatarUrl } from '../utils/urls'
import { db } from '../lib/supabase'

export default function Friends() {
  const {
    user, userProfile, friends, pendingRequests, pendingInvites,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend,
    acceptRoomInvite, rejectRoomInvite, refreshUserData, loading, sessionRestored,
  } = useAuth()
  const { getFilteredOnlineUsers, refreshOnlineUsers } = useSocket()

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('friends')
  const [sendingRequestTo, setSendingRequestTo] = useState(null)
  const router = useRouter()

  const onlineUsers = getFilteredOnlineUsers(friends)

  useEffect(() => {
    if (sessionRestored && !loading && !user) router.push('/login')
  }, [user, loading, sessionRestored, router])

  useEffect(() => {
    if (user) refreshUserData()
  }, [user, refreshUserData])

  useEffect(() => {
    const run = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setSearchResults([]); return
      }
      setSearchLoading(true); setError('')
      try {
        let data, err
        if (searchTerm.includes('#') && /^.+#\d{4}$/.test(searchTerm)) {
          const r = await db.users.getBySpecialId(searchTerm)
          data = r.data ? [r.data] : []; err = r.error
        } else {
          const r = await db.users.search(searchTerm)
          data = r.data; err = r.error
        }
        if (err) {
          setSearchResults([]); setError(`Search failed: ${err.message}`)
        } else {
          const filtered = (data || []).filter(u =>
            u.id !== userProfile?.id &&
            !friends?.some(f => f.id === u.id) &&
            !pendingRequests?.some(req => req.from_user.id === u.id || req.to_user.id === u.id)
          )
          setSearchResults(filtered)
        }
      } catch (err) {
        setSearchResults([]); setError(`Search failed: ${err.message}`)
      } finally {
        setSearchLoading(false)
      }
    }
    const t = setTimeout(run, 280)
    return () => clearTimeout(t)
  }, [searchTerm, userProfile, friends, pendingRequests])

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 3500)
  }

  const handleSendFriendRequest = async (targetUser) => {
    if (!targetUser?.id) return flash('Invalid user', true)
    setSendingRequestTo(targetUser.id)
    const result = await sendFriendRequest(targetUser.id)
    if (result?.error) flash(result.error.message, true)
    else {
      flash(`Friend request sent to ${targetUser.display_name}`)
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id))
    }
    setSendingRequestTo(null)
  }

  const handleAcceptRequest = async (id) => {
    const { error } = await acceptFriendRequest(id)
    error ? flash(error.message, true) : flash('Friend request accepted')
  }
  const handleRejectRequest = async (id) => {
    const { error } = await rejectFriendRequest(id)
    if (error) flash(error.message, true)
  }
  const handleRemoveFriend = async (friendshipId, friendName) => {
    if (!confirm(`Remove ${friendName} from your friends?`)) return
    const { error } = await removeFriend(friendshipId)
    error ? flash(error.message, true) : flash(`Removed ${friendName}`)
  }
  const handleAcceptInvite = async (inviteId, roomCode) => {
    const { error } = await acceptRoomInvite(inviteId)
    if (error) flash(error.message, true)
    else router.push(`/r/${roomCode}`)
  }
  const handleRejectInvite = async (id) => {
    const { error } = await rejectRoomInvite(id)
    if (error) flash(error.message, true)
  }

  if (!user || !userProfile) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-ink-2 text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  const userId = `${userProfile.username}#${userProfile.user_discriminator || '0000'}`

  const tabs = [
    { id: 'friends', label: 'Friends', count: friends.length, icon: 'bi-people-fill' },
    { id: 'online', label: 'Online', count: onlineUsers?.length || 0, icon: 'bi-broadcast' },
    { id: 'requests', label: 'Requests', count: pendingRequests.length, icon: 'bi-envelope' },
    { id: 'invites', label: 'Invites', count: pendingInvites.length, icon: 'bi-door-open' },
  ]

  return (
    <>
      <Head>
        <title>Friends · Party Player</title>
      </Head>

      <div className="page">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-1/90 backdrop-blur border-b border-line">
          <div className="page-shell flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-ghost px-2" aria-label="Home">
                <i className="bi bi-arrow-left text-lg" />
              </Link>
              <h1 className="text-lg font-semibold tracking-tight">Friends</h1>
            </div>
            <Link href="/profile" className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-surface-3 transition">
              <img
                src={userProfile.avatar_url || getAvatarUrl(userProfile.username)}
                alt={userProfile.display_name}
                className="w-8 h-8 rounded-full object-cover border border-line"
              />
              <span className="text-sm font-medium hidden sm:block">{userProfile.display_name}</span>
            </Link>
          </div>
        </header>

        <main className="page-shell">
          {(error || success) && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${error ? 'bg-danger-soft border border-danger/30 text-danger' : 'bg-success-soft border border-success/30 text-success'}`}>
              {error || success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: search + your ID */}
            <div className="space-y-4">
              <div className="surface-card p-5">
                <h2 className="text-sm font-semibold mb-3">Add friend</h2>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search username or user#1234"
                  className="input"
                />
                <p className="helper">Search by username or full user ID.</p>

                {searchTerm && (
                  <div className="mt-3 space-y-2">
                    {searchLoading ? (
                      <div className="text-ink-2 text-sm py-3 text-center inline-flex w-full items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
                        Searching…
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-2">
                          <img
                            src={u.avatar_url || getAvatarUrl(u.username)}
                            alt={u.display_name}
                            className="w-9 h-9 rounded-full object-cover border border-line"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{u.display_name}</div>
                            <div className="text-xs text-ink-3 truncate font-mono">
                              {u.username}#{u.user_discriminator || '0000'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(u)}
                            disabled={sendingRequestTo === u.id}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            {sendingRequestTo === u.id ? 'Sending…' : 'Add'}
                          </button>
                        </div>
                      ))
                    ) : searchTerm.length >= 2 ? (
                      <p className="text-ink-3 text-sm text-center py-3">No users found.</p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="surface-card p-5">
                <h2 className="text-sm font-semibold mb-3">Your user ID</h2>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2">
                  <img
                    src={userProfile.avatar_url || getAvatarUrl(userProfile.username)}
                    alt={userProfile.display_name}
                    className="w-10 h-10 rounded-full object-cover border border-line"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{userProfile.display_name}</div>
                    <div className="text-xs text-ink-3 truncate font-mono">{userId}</div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userId)
                      flash('User ID copied')
                    }}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    <i className="bi bi-clipboard" /> Copy
                  </button>
                </div>
                <p className="helper">Share this so friends can add you directly.</p>
              </div>
            </div>

            {/* Right: tabs + lists */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex p-1 gap-1 surface-flat overflow-x-auto scroll-hidden">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition
                      ${activeTab === t.id ? 'bg-surface-3 text-ink-0 border border-line' : 'text-ink-2 hover:text-ink-0 hover:bg-surface-2'}`}
                  >
                    <i className={`bi ${t.icon}`} />
                    <span>{t.label}</span>
                    {t.count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2'}`}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="surface-card p-5 min-h-[300px]">
                {activeTab === 'friends' && (
                  friends.length === 0 ? (
                    <EmptyState icon="bi-people" title="No friends yet" hint="Search for someone above and send a request." />
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {friends.map(f => (
                        <li key={f.friendship_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2">
                          <div className="relative">
                            <img
                              src={f.avatar_url || getAvatarUrl(f.username)}
                              alt={f.display_name}
                              className="w-10 h-10 rounded-full object-cover border border-line"
                            />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-2 ${f.is_online ? 'bg-success' : 'bg-ink-4'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{f.display_name}</div>
                            <div className="text-xs text-ink-3 truncate">{f.is_online ? 'Online' : 'Offline'}</div>
                          </div>
                          <button
                            onClick={() => handleRemoveFriend(f.friendship_id, f.display_name)}
                            className="btn-ghost py-1.5 px-2 text-xs text-danger"
                            aria-label="Remove"
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {activeTab === 'online' && (
                  !onlineUsers || onlineUsers.length === 0 ? (
                    <EmptyState icon="bi-broadcast" title="No one else is online" hint="Check back later or add friends." actionLabel="Refresh" onAction={refreshOnlineUsers} />
                  ) : (
                    <ul className="space-y-2">
                      {onlineUsers.map(u => (
                        <li key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2">
                          <div className="relative">
                            <img
                              src={u.avatar_url || getAvatarUrl(u.username)}
                              alt={u.display_name}
                              className="w-10 h-10 rounded-full object-cover border border-line"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface-2" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{u.display_name}</div>
                            <div className="text-xs text-ink-3 truncate font-mono">{u.username}#{u.user_discriminator || '0000'}</div>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(u)}
                            disabled={sendingRequestTo === u.id}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            {sendingRequestTo === u.id ? 'Sending…' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {activeTab === 'requests' && (
                  pendingRequests.length === 0 ? (
                    <EmptyState icon="bi-envelope" title="No pending requests" hint="You're all caught up." />
                  ) : (
                    <ul className="space-y-2">
                      {pendingRequests.map(r => (
                        <li key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2">
                          <img
                            src={r.from_user.avatar_url || getAvatarUrl(r.from_user.username)}
                            alt={r.from_user.display_name}
                            className="w-10 h-10 rounded-full object-cover border border-line"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{r.from_user.display_name}</div>
                            <div className="text-xs text-ink-3 truncate font-mono">{r.from_user.username}#{r.from_user.user_discriminator || '0000'}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleAcceptRequest(r.id)} className="btn-primary py-1.5 px-3 text-xs">Accept</button>
                            <button onClick={() => handleRejectRequest(r.id)} className="btn-ghost py-1.5 px-3 text-xs">Decline</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}

                {activeTab === 'invites' && (
                  pendingInvites.length === 0 ? (
                    <EmptyState icon="bi-door-open" title="No room invites" hint="Invites from friends will show here." />
                  ) : (
                    <ul className="space-y-2">
                      {pendingInvites.map(i => (
                        <li key={i.id} className="p-3 rounded-xl bg-surface-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={i.from_user.avatar_url || getAvatarUrl(i.from_user.username)}
                              alt={i.from_user.display_name}
                              className="w-10 h-10 rounded-full object-cover border border-line"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {i.from_user.display_name} invited you
                              </div>
                              <div className="text-xs text-ink-3 truncate">
                                Room <span className="font-mono">{i.room_code}</span> · {new Date(i.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAcceptInvite(i.id, i.room_code)} className="btn-primary py-1.5 px-3 text-xs">Join</button>
                              <button onClick={() => handleRejectInvite(i.id)} className="btn-ghost py-1.5 px-3 text-xs">Decline</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

function EmptyState({ icon, title, hint, actionLabel, onAction }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-3 border border-line grid place-items-center mb-3">
        <i className={`bi ${icon} text-xl text-ink-3`} />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-ink-3 text-sm mt-1">{hint}</p>
      {actionLabel && (
        <button onClick={onAction} className="btn-secondary mt-4 py-1.5 text-xs">{actionLabel}</button>
      )}
    </div>
  )
}
