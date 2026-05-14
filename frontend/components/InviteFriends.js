import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../utils/urls'

export default function InviteFriends({ roomCode, roomData, isVisible, onClose }) {
  const { friends, sendRoomInvite } = useAuth()
  const [loading, setLoading] = useState({})
  const [success, setSuccess] = useState({})
  const [error, setError] = useState('')

  if (!isVisible) return null

  const onlineFriends = friends.filter(f => f.is_online)
  const offlineFriends = friends.filter(f => !f.is_online)

  const handleInvite = async (friendId) => {
    setLoading(prev => ({ ...prev, [friendId]: true }))
    setError('')
    const { error } = await sendRoomInvite(friendId, roomCode, roomData)
    if (error) setError(error.message)
    else {
      setSuccess(prev => ({ ...prev, [friendId]: true }))
      setTimeout(() => setSuccess(prev => ({ ...prev, [friendId]: false })), 3000)
    }
    setLoading(prev => ({ ...prev, [friendId]: false }))
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="surface-raised w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div>
            <h3 className="font-semibold">Invite friends</h3>
            <p className="text-xs text-ink-3 mt-0.5">
              Room <span className="font-mono">{roomCode}</span>
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2" aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto scroll-thin">
          {error && (
            <div className="mb-3 p-2.5 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          {friends.length === 0 ? (
            <div className="text-center py-10">
              <i className="bi bi-people text-3xl text-ink-3" />
              <p className="text-ink-2 text-sm mt-2">No friends yet</p>
              <p className="text-ink-3 text-xs mt-1">Add friends to invite them to your rooms.</p>
            </div>
          ) : (
            <>
              {onlineFriends.length > 0 && (
                <>
                  <div className="section-title mb-2 px-1">Online · {onlineFriends.length}</div>
                  <div className="space-y-1 mb-4">
                    {onlineFriends.map((f) => (
                      <FriendRow key={f.id} friend={f} online
                        onInvite={() => handleInvite(f.id)}
                        loading={loading[f.id]} success={success[f.id]} />
                    ))}
                  </div>
                </>
              )}
              {offlineFriends.length > 0 && (
                <>
                  <div className="section-title mb-2 px-1">Offline · {offlineFriends.length}</div>
                  <div className="space-y-1">
                    {offlineFriends.map((f) => (
                      <FriendRow key={f.id} friend={f}
                        onInvite={() => handleInvite(f.id)}
                        loading={loading[f.id]} success={success[f.id]} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FriendRow({ friend, online, onInvite, loading, success }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 transition">
      <div className="relative">
        <img
          src={friend.avatar_url || getAvatarUrl(friend.username)}
          alt={friend.display_name}
          className="w-9 h-9 rounded-full object-cover border border-line"
        />
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-surface-3" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{friend.display_name}</div>
        <div className="text-xs text-ink-3 truncate">@{friend.username}</div>
      </div>
      <button
        onClick={onInvite}
        disabled={loading || success}
        className={success ? 'chip chip-success' : 'btn-primary py-1.5 px-3 text-xs'}
      >
        {success ? (<><i className="bi bi-check2" /> Invited</>) : loading ? 'Sending…' : 'Invite'}
      </button>
    </div>
  )
}
