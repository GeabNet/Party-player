import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { io } from 'socket.io-client';
import ServerStatus from '../../components/ServerStatus';
import InviteFriends from '../../components/InviteFriends';
import RoomInviteNotifications from '../../components/RoomInviteNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl, getYouTubeApiUrl } from '../../utils/urls';

export default function Room() {
  const router = useRouter();
  const { code } = router.query;
  const { user, userProfile, loading, sessionRestored, sendFriendRequest } = useAuth();

  /* ----------------------------- connection state ---------------------------- */
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);

  /* ------------------------------- video state ------------------------------- */
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const playerRef = useRef(null);

  /* -------------------------------- chat state ------------------------------- */
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  /* ------------------------------- voice state ------------------------------- */
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const audioElementsRef = useRef({});

  /* --------------------------------- UI state -------------------------------- */
  const [error, setError] = useState('');
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // chat | people | voice
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, targetUser: null });
  const [friendRequestLoading, setFriendRequestLoading] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);

  /* ----------------------------- auth redirect ----------------------------- */
  useEffect(() => {
    if (sessionRestored && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, sessionRestored, router]);

  /* ------------------------- youtube iframe API load ------------------------- */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      setIsPlayerReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = getYouTubeApiUrl();
    tag.async = true;
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);

    window.onYouTubeIframeAPIReady = () => setIsPlayerReady(true);

    const fallback = setTimeout(() => {
      if (window.YT && window.YT.Player) setIsPlayerReady(true);
    }, 8000);
    return () => clearTimeout(fallback);
  }, []);

  /* --------------------------- close context menu --------------------------- */
  useEffect(() => {
    const close = () => setContextMenu({ show: false, x: 0, y: 0, targetUser: null });
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  /* ----------------------------- video player ------------------------------ */
  const loadVideoInPlayer = useCallback((videoId) => {
    if (!window.YT || !window.YT.Player) {
      setError('YouTube API not loaded yet. Please refresh.');
      setIsVideoLoading(false);
      return;
    }
    const el = document.getElementById('youtube-player');
    if (!el) return;

    if (playerRef.current) playerRef.current.destroy();

    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 0,
        controls: isHost ? 1 : 0,
        disablekb: !isHost ? 1 : 0,
        fs: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
      },
      events: {
        onStateChange: (event) => {
          if (!isHost) return;
          const currentTime = event.target.getCurrentTime();
          if (event.data === window.YT.PlayerState.PLAYING) {
            socket?.emit('video-play', { roomCode: code.toUpperCase(), currentTime });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            socket?.emit('video-pause', { roomCode: code.toUpperCase(), currentTime });
          }
        },
        onError: (event) => setError(`YouTube error: ${event.data}`),
      },
    });
  }, [isHost, socket, code]);

  /* ----------------------------- socket setup ------------------------------ */
  useEffect(() => {
    if (!code || !user || !userProfile) return;
    setIsInitialLoad(true);

    const s = io(process.env.NEXT_PUBLIC_SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(s);

    const userData = {
      roomCode: code.toUpperCase(),
      username: userProfile.display_name,
      avatar: userProfile.avatar_url,
      isAuthenticated: true,
      userId: user.id,
      userProfile,
    };

    s.on('connect', () => {
      setIsConnected(true);
      s.emit('join-room', userData);
    });
    s.on('disconnect', () => setIsConnected(false));
    s.on('connect_error', () => setError('Connection failed. Retrying…'));
    s.on('reconnect', () => {
      setError('');
      s.emit('join-room', userData);
    });

    s.on('joined-room', (data) => {
      setRoomData(data);
      setIsHost(data.isHost);
      setCurrentVideo(data.currentVideo);
      setMessages(data.messages || []);
      setUsers(data.users || []);
      setError('');
      setIsInitialLoad(false);
    });

    s.on('error', (data) => {
      setError(data.message);
      if (data.message === 'Room not found') {
        setTimeout(() => router.push('/'), 2500);
      }
    });

    // video
    s.on('video-loaded', (data) => {
      setCurrentVideo({ videoId: data.videoId, title: data.title });
      setIsVideoLoading(false);
      loadVideoInPlayer(data.videoId);
    });
    s.on('video-play', (data) => {
      if (playerRef.current?.seekTo && playerRef.current?.playVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.playVideo();
      }
    });
    s.on('video-pause', (data) => {
      if (playerRef.current?.seekTo && playerRef.current?.pauseVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.pauseVideo();
      }
    });
    s.on('video-seek', (data) => {
      if (playerRef.current?.seekTo) playerRef.current.seekTo(data.time, true);
    });

    // chat
    s.on('new-message', (message) => setMessages((prev) => [...prev, message]));

    // users
    s.on('user-joined', (data) => setUsers((prev) => [...prev, data.user]));
    s.on('user-left', (data) => {
      setUsers((prev) => prev.filter((u) => u.id !== data.user.id));
      if (data.newHost) setIsHost(data.newHost.id === s.id);
    });
    s.on('new-host', (data) => setIsHost(data.newHost.id === s.id));

    // voice
    s.on('voice-chat-users', (vu) => setVoiceUsers(vu || []));
    s.on('user-joined-voice', (data) => {
      setVoiceUsers((prev) => [...new Set([...prev, data.callerID])]);
      if (localStreamRef.current && data.callerID !== s.id) {
        const peer = createPeer(data.callerID, s.id, localStreamRef.current, s);
        peersRef.current[data.callerID] = peer;
      }
    });
    s.on('user-left-voice', (data) => {
      setVoiceUsers((prev) => prev.filter((id) => id !== data.callerID));
      setMutedUsers((prev) => prev.filter((id) => id !== data.callerID));
      if (peersRef.current[data.callerID]) {
        peersRef.current[data.callerID].destroy();
        delete peersRef.current[data.callerID];
      }
      if (audioElementsRef.current[data.callerID]) {
        audioElementsRef.current[data.callerID].pause();
        audioElementsRef.current[data.callerID].srcObject = null;
        delete audioElementsRef.current[data.callerID];
      }
    });
    s.on('user-muted', (data) => setMutedUsers((prev) => [...new Set([...prev, data.userId])]));
    s.on('user-unmuted', (data) => setMutedUsers((prev) => prev.filter((id) => id !== data.userId)));
    s.on('receiving-signal', (payload) => {
      if (localStreamRef.current) {
        const peer = addPeer(payload.signal, payload.callerID, localStreamRef.current, s);
        peersRef.current[payload.callerID] = peer;
      }
    });
    s.on('receiving-returned-signal', (payload) => {
      const item = peersRef.current[payload.id];
      if (item) item.signal(payload.signal);
    });

    return () => {
      s.disconnect();
      setIsInitialLoad(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user, userProfile]);

  /* ------------------------ auto-scroll new messages ------------------------ */
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isInitialLoad]);

  /* ----------------------- recreate player when ready ---------------------- */
  useEffect(() => {
    if (isPlayerReady && currentVideo?.videoId && !playerRef.current) {
      loadVideoInPlayer(currentVideo.videoId);
    }
  }, [isPlayerReady, currentVideo, loadVideoInPlayer]);

  /* ---------------------------- voice chat funcs ---------------------------- */
  const createPeer = (userToCall, callerID, stream, s) => {
    const Peer = require('simple-peer');
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });
    peer.on('signal', (signal) => s.emit('sending-signal', { userToCall, callerID, signal }));
    peer.on('stream', (remoteStream) => {
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = isDeafened;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioElementsRef.current[userToCall] = audio;
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream, s) => {
    const Peer = require('simple-peer');
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });
    peer.on('signal', (signal) => s.emit('returning-signal', { signal, callerID }));
    peer.on('stream', (remoteStream) => {
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = isDeafened;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioElementsRef.current[callerID] = audio;
    });
    peer.signal(incomingSignal);
    return peer;
  };

  const initializeVoice = async () => {
    try {
      setIsConnecting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
      socket.emit('join-voice-chat', { roomCode: code, username: userProfile.display_name });
      setIsVoiceChatEnabled(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      setError('Microphone access denied. Check permissions.');
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveVoice = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    Object.values(peersRef.current).forEach((p) => p.destroy());
    peersRef.current = {};
    Object.values(audioElementsRef.current).forEach((a) => {
      a.pause();
      a.srcObject = null;
    });
    audioElementsRef.current = {};
    socket?.emit('leave-voice-chat', { roomCode: code });
    setIsVoiceChatEnabled(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
      setIsMuted((v) => !v);
      socket?.emit(isMuted ? 'user-unmuted' : 'user-muted', { roomCode: code });
    }
  };

  const toggleDeafen = () => {
    setIsDeafened((v) => !v);
    Object.values(audioElementsRef.current).forEach((a) => {
      a.muted = !isDeafened;
    });
  };

  /* ----------------------------- chat handlers ----------------------------- */
  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text || !socket) return;
    socket.emit('send-message', { roomCode: code.toUpperCase(), message: text });
    setNewMessage('');
    chatInputRef.current?.focus();
  };

  /* ---------------------------- video handlers ----------------------------- */
  const loadVideo = () => {
    if (!isHost) {
      setError('Only the host can load videos.');
      return;
    }
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setError('Paste a YouTube URL first.');
      return;
    }
    setIsVideoLoading(true);
    setError('');
    socket.emit('load-video', { roomCode: code.toUpperCase(), videoUrl: trimmed });
    setVideoUrl('');
  };

  /* ----------------------------- room actions ----------------------------- */
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(code.toUpperCase());
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1600);
    } catch {
      // ignore
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1600);
    } catch {
      // ignore
    }
  };

  /* --------------------------- right-click handlers -------------------------- */
  const handleUserRightClick = (e, targetUser) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetUser.id === user?.id) return;
    setContextMenu({ show: true, x: e.pageX, y: e.pageY, targetUser });
  };

  const handleSendFriendRequest = async () => {
    if (!contextMenu.targetUser) return;
    setFriendRequestLoading(true);
    setError('');
    try {
      const targetUserId = contextMenu.targetUser.id || contextMenu.targetUser.userId;
      if (!targetUserId) throw new Error('User id missing.');
      const result = await sendFriendRequest(targetUserId);
      if (result?.error) setError(`Friend request failed: ${result.error.message}`);
    } catch (err) {
      setError(`Friend request failed: ${err.message}`);
    } finally {
      setFriendRequestLoading(false);
      setContextMenu({ show: false, x: 0, y: 0, targetUser: null });
    }
  };

  const userCount = users.length;
  const inVoiceCount = voiceUsers.length;

  /* ------------------------- early auth / loading UI ------------------------ */
  if (loading || !code) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center text-ink-2">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
          <p className="text-sm">Joining room…</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="page flex items-center justify-center px-4">
        <div className="surface-card p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold">Sign in to join</h1>
          <p className="text-ink-2 mt-2 text-sm">You need an account to enter this room.</p>
          <div className="flex gap-2 mt-6 justify-center">
            <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
            <button onClick={() => router.push('/')} className="btn-secondary">Go home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Room {code} · Party Player</title>
        <meta name="theme-color" content="#0A0A0B" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="page flex flex-col h-screen overflow-hidden">
        <ServerStatus />
        <RoomInviteNotifications />

        {/* Top bar */}
        <header className="bg-surface-1/95 backdrop-blur border-b border-line">
          <div className="px-3 sm:px-5 py-3 flex items-center gap-3">
            <button onClick={() => router.push('/')} className="btn-ghost px-2" aria-label="Leave room">
              <i className="bi bi-arrow-left text-lg" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent grid place-items-center text-white text-sm font-bold shrink-0">P</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tracking-tight truncate">Room</span>
                  <button
                    onClick={copyRoomCode}
                    className="px-2 py-0.5 rounded-md bg-surface-3 border border-line text-xs font-mono tracking-widest hover:bg-surface-4 transition"
                    title="Copy room code"
                  >
                    {code?.toUpperCase()}
                  </button>
                  {isHost && <span className="chip chip-accent">HOST</span>}
                </div>
                <div className="text-xs text-ink-3 flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
                  {isConnected ? 'Connected' : 'Connecting…'} · {userCount} {userCount === 1 ? 'person' : 'people'}
                </div>
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <button onClick={copyRoomLink} className="btn-secondary hidden sm:inline-flex">
                <i className="bi bi-link-45deg" />
                {copyFlash ? 'Copied' : 'Share link'}
              </button>
              <button onClick={() => setShowInviteFriends(true)} className="btn-primary">
                <i className="bi bi-person-plus" />
                <span className="hidden sm:inline">Invite friends</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 sm:px-5 pb-3">
              <div className="p-2.5 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError('')} className="text-danger/80 hover:text-danger px-2">
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Video area */}
          <div className="flex-1 flex flex-col p-3 sm:p-5 overflow-y-auto scroll-thin">
            <div className="surface-card overflow-hidden">
              <div className="relative aspect-video bg-black">
                {currentVideo?.videoId ? (
                  <div id="youtube-player" className="absolute inset-0 w-full h-full" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center px-6">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-3 border border-line grid place-items-center mb-4">
                        <i className="bi bi-youtube text-2xl text-danger" />
                      </div>
                      <h3 className="text-lg font-semibold">No video yet</h3>
                      <p className="text-ink-2 text-sm mt-1">
                        {isHost ? 'Paste a YouTube link below to start the party.' : 'Waiting for the host to load a video.'}
                      </p>
                    </div>
                  </div>
                )}
                {isVideoLoading && (
                  <div className="absolute inset-0 grid place-items-center bg-surface-1/80 backdrop-blur-sm">
                    <div className="w-10 h-10 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="surface-flat p-4 mt-3">
                <div className="flex items-center gap-2 mb-3">
                  <i className="bi bi-youtube text-danger" />
                  <span className="text-sm font-medium">Load a video</span>
                  <span className="chip chip-accent ml-auto">HOST</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadVideo()}
                    placeholder="https://youtube.com/watch?v=…"
                    className="input flex-1"
                  />
                  <button onClick={loadVideo} disabled={isVideoLoading || !videoUrl.trim()} className="btn-primary">
                    <i className="bi bi-play-fill" /> Load
                  </button>
                </div>
                {currentVideo?.title && (
                  <p className="helper mt-3">Now playing: <span className="text-ink-1">{currentVideo.title}</span></p>
                )}
              </div>
            )}
            {!isHost && currentVideo?.title && (
              <div className="surface-flat p-4 mt-3 text-sm">
                <span className="text-ink-3">Now playing · </span>
                <span className="font-medium">{currentVideo.title}</span>
              </div>
            )}
          </div>

          {/* Right rail / tabbed panel */}
          <aside className="lg:w-[400px] lg:border-l lg:border-line bg-surface-2 flex flex-col border-t lg:border-t-0 border-line">
            {/* Tabs */}
            <div className="p-2 border-b border-line bg-surface-2 sticky top-0 z-10">
              <div className="flex p-1 gap-1 bg-surface-1 border border-line rounded-xl">
                <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon="bi-chat-dots-fill" label="Chat" count={messages.length || null} />
                <TabButton active={activeTab === 'people'} onClick={() => setActiveTab('people')} icon="bi-people-fill" label="People" count={userCount} />
                <TabButton active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} icon="bi-mic-fill" label="Voice" count={inVoiceCount || null} live={isVoiceChatEnabled} />
              </div>
            </div>

            {/* Panels */}
            {activeTab === 'chat' && (
              <ChatPanel
                messages={messages}
                myName={userProfile.display_name}
                value={newMessage}
                setValue={setNewMessage}
                onSend={sendMessage}
                inputRef={chatInputRef}
                bottomRef={messagesEndRef}
              />
            )}

            {activeTab === 'people' && (
              <PeoplePanel
                users={users}
                voiceUsers={voiceUsers}
                mutedUsers={mutedUsers}
                currentUserId={user.id}
                socketId={socket?.id}
                isHostId={roomData?.hostId}
                onRightClick={handleUserRightClick}
              />
            )}

            {activeTab === 'voice' && (
              <VoicePanel
                enabled={isVoiceChatEnabled}
                connecting={isConnecting}
                isMuted={isMuted}
                isDeafened={isDeafened}
                voiceUsers={voiceUsers}
                mutedUsers={mutedUsers}
                users={users}
                socketId={socket?.id}
                onJoin={initializeVoice}
                onLeave={leaveVoice}
                onToggleMute={toggleMute}
                onToggleDeafen={toggleDeafen}
              />
            )}
          </aside>
        </div>

        {/* Context menu */}
        {contextMenu.show && contextMenu.targetUser && (
          <div
            className="fixed surface-raised py-1.5 z-50 w-56"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 150) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-line">
              <div className="text-sm font-medium truncate">{contextMenu.targetUser.username}</div>
              <div className="text-xs text-ink-3">In this room</div>
            </div>
            <button
              onClick={handleSendFriendRequest}
              disabled={friendRequestLoading}
              className="w-full px-3 py-2 text-sm text-left hover:bg-surface-3 transition flex items-center gap-2"
            >
              <i className="bi bi-person-plus" />
              {friendRequestLoading ? 'Sending…' : 'Send friend request'}
            </button>
          </div>
        )}

        {/* Invite friends modal */}
        {showInviteFriends && (
          <InviteFriends
            roomCode={code?.toUpperCase()}
            roomData={{ room_name: `Room ${code}`, inviter_name: userProfile.display_name }}
            isVisible={showInviteFriends}
            onClose={() => setShowInviteFriends(false)}
          />
        )}
      </div>
    </>
  );
}

/* ============================== sub components ============================== */

function TabButton({ active, onClick, icon, label, count, live }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition relative
        ${active ? 'bg-surface-3 text-ink-0 shadow-soft' : 'text-ink-2 hover:text-ink-0 hover:bg-surface-2'}`}
    >
      <i className={`bi ${icon} text-base`} />
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[18px] text-center ${active ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2'}`}>
          {count}
        </span>
      )}
      {live && (
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
      )}
    </button>
  );
}

function ChatPanel({ messages, myName, value, setValue, onSend, inputRef, bottomRef }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center py-10">
            <div className="max-w-[220px]">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-accent-soft border border-accent/30 grid place-items-center mb-3">
                <i className="bi bi-chat-dots-fill text-2xl text-accent" />
              </div>
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs text-ink-3 mt-1">Say hi or react to the video.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.username === myName;
          const prev = messages[i - 1];
          const next = messages[i + 1];

          // Time separator if gap > 5 min from previous
          const showTimeBreak =
            !prev ||
            (m.timestamp && prev.timestamp && m.timestamp - prev.timestamp > 5 * 60 * 1000);

          const sameAsPrev = prev && prev.username === m.username && !showTimeBreak;
          const sameAsNext = next && next.username === m.username && (!next.timestamp || !m.timestamp || next.timestamp - m.timestamp < 5 * 60 * 1000);

          const showHeader = !sameAsPrev;

          // Corner rounding for stacked messages
          let cornerCls = '';
          if (mine) {
            if (sameAsPrev && sameAsNext) cornerCls = 'rounded-r-md';
            else if (sameAsPrev) cornerCls = 'rounded-tr-md';
            else if (sameAsNext) cornerCls = 'rounded-br-md';
            else cornerCls = 'rounded-br-md';
          } else {
            if (sameAsPrev && sameAsNext) cornerCls = 'rounded-l-md';
            else if (sameAsPrev) cornerCls = 'rounded-tl-md';
            else if (sameAsNext) cornerCls = 'rounded-bl-md';
            else cornerCls = 'rounded-bl-md';
          }

          return (
            <div key={m.id || i}>
              {showTimeBreak && m.timestamp && (
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-[10px] uppercase tracking-wider text-ink-3 font-medium">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-2'} animate-fade-in-up`}>
                <div className={`max-w-[82%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {showHeader && (
                    <div className={`text-[11px] text-ink-3 mb-1 px-1 flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                      <span className="font-semibold text-ink-1">{mine ? 'You' : m.username}</span>
                      {m.timestamp && (
                        <span className="text-ink-3">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  )}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-soft
                    ${mine ? `bg-accent text-white ${cornerCls}` : `bg-surface-3 border border-line text-ink-0 ${cornerCls}`}`}>
                    {m.message}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-line p-3 bg-surface-2">
        <div className={`flex items-center gap-2 bg-surface-1 border rounded-2xl px-3 py-1.5 transition
          ${isFocused ? 'border-accent ring-4 ring-accent/20' : 'border-line'}`}>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Send a message…"
            className="flex-1 bg-transparent outline-none text-sm py-2 placeholder-ink-3"
            maxLength={500}
          />
          {value.length > 400 && (
            <span className="text-[10px] text-ink-3 font-mono">{500 - value.length}</span>
          )}
          <button
            onClick={onSend}
            disabled={!value.trim()}
            className={`w-9 h-9 rounded-xl grid place-items-center transition shrink-0
              ${value.trim() ? 'bg-accent text-white hover:bg-accent-hover active:scale-95' : 'bg-surface-3 text-ink-3 cursor-not-allowed'}`}
            aria-label="Send"
          >
            <i className="bi bi-send-fill text-sm" />
          </button>
        </div>
        <p className="text-[10px] text-ink-3 mt-2 px-1">Press Enter to send</p>
      </div>
    </div>
  );
}

function PeoplePanel({ users, voiceUsers, mutedUsers, currentUserId, socketId, isHostId, onRightClick }) {
  const inVoiceUsers = users.filter(u => voiceUsers.includes(u.id));
  const watchingUsers = users.filter(u => !voiceUsers.includes(u.id));

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-3">
      {inVoiceUsers.length > 0 && (
        <>
          <SectionHeader icon="bi-mic-fill" label="In voice" count={inVoiceUsers.length} />
          <div className="space-y-1 mb-4">
            {inVoiceUsers.map((u) => (
              <PersonRow
                key={u.id} u={u} muted={mutedUsers.includes(u.id)} inVoice
                isMe={u.id === currentUserId || u.id === socketId}
                isUserHost={u.isHost || u.id === isHostId}
                onRightClick={onRightClick}
              />
            ))}
          </div>
        </>
      )}
      <SectionHeader icon="bi-eye-fill" label="Watching" count={watchingUsers.length} />
      <div className="space-y-1">
        {watchingUsers.map((u) => (
          <PersonRow
            key={u.id} u={u}
            isMe={u.id === currentUserId || u.id === socketId}
            isUserHost={u.isHost || u.id === isHostId}
            onRightClick={onRightClick}
          />
        ))}
      </div>
      <p className="text-[10px] text-ink-3 mt-4 px-1">Right-click a user to send a friend request.</p>
    </div>
  );
}

function SectionHeader({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <i className={`bi ${icon} text-[10px] text-ink-3`} />
      <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.16em]">{label}</span>
      <span className="text-[10px] font-semibold text-ink-3">· {count}</span>
    </div>
  );
}

function PersonRow({ u, muted, inVoice, isMe, isUserHost, onRightClick }) {
  return (
    <div
      onContextMenu={(e) => onRightClick(e, u)}
      className="group flex items-center gap-3 p-2 rounded-xl hover:bg-surface-3 transition cursor-pointer"
    >
      <div className="relative shrink-0">
        <img
          src={u.avatar || getAvatarUrl(u.username || u.display_name || 'U')}
          alt={u.username}
          className="w-9 h-9 rounded-full object-cover border border-line"
        />
        {inVoice && (
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center border-2 border-surface-2
            ${muted ? 'bg-danger' : 'bg-success'}`}>
            <i className={`bi ${muted ? 'bi-mic-mute-fill' : 'bi-mic-fill'} text-[8px] text-white`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          {u.username || u.display_name}
          {isMe && <span className="text-ink-3 text-[10px] font-normal">· you</span>}
        </div>
        <div className="text-[11px] text-ink-3 truncate">
          {isUserHost ? 'Host of the room' : inVoice ? (muted ? 'Voice · muted' : 'Voice · talking') : 'Watching'}
        </div>
      </div>
      {isUserHost && (
        <span className="chip chip-accent text-[9px] py-0.5">
          <i className="bi bi-star-fill" /> HOST
        </span>
      )}
    </div>
  );
}

function VoicePanel({
  enabled, connecting, isMuted, isDeafened,
  voiceUsers, mutedUsers, users, socketId,
  onJoin, onLeave, onToggleMute, onToggleDeafen,
}) {
  const speakers = useMemo(() => users.filter((u) => voiceUsers.includes(u.id)), [users, voiceUsers]);

  return (
    <div className="flex-1 flex flex-col p-4">
      {!enabled ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-accent/15 blur-2xl" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent-hover grid place-items-center shadow-glow">
              <i className="bi bi-mic-fill text-4xl text-white" />
            </div>
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Voice chat</h3>
          <p className="text-ink-2 text-sm mt-1.5 max-w-[260px]">
            Talk with everyone in the room while you watch together.
          </p>
          <button onClick={onJoin} disabled={connecting} className="btn-primary btn-lg mt-6 w-full max-w-[240px]">
            {connecting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Connecting…
              </span>
            ) : (
              <>
                <i className="bi bi-mic-fill" />
                Join voice
              </>
            )}
          </button>
          <p className="helper mt-4 flex items-center gap-1.5 justify-center">
            <i className="bi bi-shield-check" /> Your browser will ask for mic permission.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.16em]">
                Live · {speakers.length}
              </span>
            </div>
            <span className="text-[10px] text-ink-3">
              {isMuted ? 'You are muted' : 'You are live'}
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto scroll-thin">
            {speakers.length === 0 && (
              <div className="text-center text-ink-3 text-sm py-10">
                <i className="bi bi-soundwave text-2xl block mb-2" />
                Waiting for others to join…
              </div>
            )}
            {speakers.map((u) => {
              const muted = mutedUsers.includes(u.id);
              const isMe = u.id === socketId;
              return (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-3 border border-line">
                  <div className="relative">
                    <img
                      src={u.avatar || getAvatarUrl(u.username || 'U')}
                      alt={u.username}
                      className={`w-10 h-10 rounded-full object-cover border-2 transition
                        ${muted ? 'border-danger/50' : 'border-success/60'}`}
                    />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center border-2 border-surface-3
                      ${muted ? 'bg-danger' : 'bg-success'}`}>
                      <i className={`bi ${muted ? 'bi-mic-mute-fill' : 'bi-mic-fill'} text-[8px] text-white`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.username || u.display_name}
                      {isMe && <span className="text-ink-3 text-[10px] font-normal ml-1">· you</span>}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      {muted ? 'Muted' : 'Speaking'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Voice control bar */}
          <div className="mt-3 surface-flat p-2 flex items-center justify-around gap-2">
            <VoiceControl
              onClick={onToggleMute} dangerWhenOff active={!isMuted}
              icon={isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}
              label={isMuted ? 'Unmute' : 'Mute'}
            />
            <VoiceControl
              onClick={onToggleDeafen} dangerWhenOff active={!isDeafened}
              icon={isDeafened ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}
              label={isDeafened ? 'Undeafen' : 'Deafen'}
            />
            <VoiceControl onClick={onLeave} danger icon="bi-telephone-x-fill" label="Leave" />
          </div>
        </>
      )}
    </div>
  );
}

function VoiceControl({ icon, label, onClick, active, danger, dangerWhenOff }) {
  let cls = 'flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition select-none active:scale-95';
  if (danger) cls += ' bg-danger/15 hover:bg-danger/25 text-danger';
  else if (dangerWhenOff && !active) cls += ' bg-danger/15 hover:bg-danger/25 text-danger';
  else cls += ' bg-surface-3 hover:bg-surface-4 text-ink-0 border border-line';
  return (
    <button onClick={onClick} className={cls}>
      <i className={`bi ${icon} text-lg`} />
      <span className="text-[10px] font-semibold tracking-wider uppercase">{label}</span>
    </button>
  );
}
