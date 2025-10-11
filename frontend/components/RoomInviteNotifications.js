import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'

export default function RoomInviteNotifications() {
  const { pendingInvites, acceptRoomInvite, rejectRoomInvite } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setShowNotifications(pendingInvites.length > 0)
  }, [pendingInvites])

  const handleAcceptInvite = async (invite) => {
    try {
      const result = await acceptRoomInvite(invite.id)
      if (!result.error) {
        // Navigate to the room
        router.push(`/r/${invite.room_code}/lobby`)
      }
    } catch (error) {
      console.error('Error accepting invite:', error)
    }
  }

  const handleRejectInvite = async (inviteId) => {
    try {
      await rejectRoomInvite(inviteId)
    } catch (error) {
      console.error('Error rejecting invite:', error)
    }
  }

  if (!showNotifications || pendingInvites.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {pendingInvites.slice(0, 3).map((invite) => (
        <div
          key={invite.id}
          className="bg-gray-800 border border-purple-500 rounded-lg p-4 shadow-lg max-w-sm animate-pulse"
        >
          <div className="flex items-start space-x-3">
            <img
              src={invite.from_user.avatar_url}
              alt={invite.from_user.display_name}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                Room Invite
              </p>
              <p className="text-xs text-gray-300">
                <span className="font-medium">{invite.from_user.display_name}</span> invited you to room{' '}
                <span className="font-mono bg-gray-700 px-1 rounded">{invite.room_code}</span>
              </p>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={() => handleAcceptInvite(invite)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Join
                </button>
                <button
                  onClick={() => handleRejectInvite(invite.id)}
                  className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
            <button
              onClick={() => handleRejectInvite(invite.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      
      {pendingInvites.length > 3 && (
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-300">
            +{pendingInvites.length - 3} more invites
          </p>
          <button
            onClick={() => router.push('/friends')}
            className="text-purple-400 hover:text-purple-300 text-xs underline"
          >
            View all
          </button>
        </div>
      )}
    </div>
  )
}