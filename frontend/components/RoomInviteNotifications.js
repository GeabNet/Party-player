import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../utils/urls'

export default function RoomInviteNotifications() {
  const { pendingInvites, acceptRoomInvite, rejectRoomInvite } = useAuth()
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setShow(pendingInvites.length > 0)
  }, [pendingInvites])

  const handleAccept = async (invite) => {
    try {
      const result = await acceptRoomInvite(invite.id)
      if (!result.error) router.push(`/r/${invite.room_code}`)
    } catch (error) {
      console.error('Error accepting invite:', error)
    }
  }

  const handleReject = async (id) => {
    try { await rejectRoomInvite(id) } catch (e) { console.error(e) }
  }

  if (!show || pendingInvites.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none">
      {pendingInvites.slice(0, 3).map((invite) => (
        <div
          key={invite.id}
          className="pointer-events-auto surface-raised p-3 animate-fade-in-up"
        >
          <div className="flex items-start gap-3">
            <img
              src={invite.from_user.avatar_url || getAvatarUrl(invite.from_user.username || 'U')}
              alt={invite.from_user.display_name}
              className="w-9 h-9 rounded-full object-cover border border-line shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <span className="font-medium">{invite.from_user.display_name}</span>{' '}
                <span className="text-ink-2">invited you to</span>{' '}
                <span className="font-mono text-xs bg-surface-3 border border-line px-1.5 py-0.5 rounded">
                  {invite.room_code}
                </span>
              </div>
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => handleAccept(invite)} className="btn-primary py-1.5 px-3 text-xs">
                  Join
                </button>
                <button onClick={() => handleReject(invite.id)} className="btn-ghost py-1.5 px-3 text-xs">
                  Decline
                </button>
              </div>
            </div>
            <button
              onClick={() => handleReject(invite.id)}
              className="text-ink-3 hover:text-ink-0 transition p-1"
              aria-label="Dismiss"
            >
              <i className="bi bi-x-lg text-sm" />
            </button>
          </div>
        </div>
      ))}

      {pendingInvites.length > 3 && (
        <div className="pointer-events-auto surface-flat p-2.5 text-center">
          <p className="text-xs text-ink-2">+{pendingInvites.length - 3} more invites</p>
          <button onClick={() => router.push('/friends')} className="text-accent hover:text-accent-hover text-xs font-medium mt-1">
            View all
          </button>
        </div>
      )}
    </div>
  )
}
