import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';

/**
 * VideoChat - lightweight video call component that reuses the server's
 * existing signaling events (join-voice-chat, sending-signal, returning-signal)
 * which allows us to piggyback on the voice signalling flow already implemented
 * on the server. This provides quick, small-group mesh video calling.
 */
export default function VideoChat({ socket, roomCode, username, isVisible, onClose }) {
  const [isActive, setIsActive] = useState(false);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const videoElementsRef = useRef({});

  useEffect(() => {
    if (!isVisible) return;
    // when opened, do nothing until user clicks "Start Video"
    return () => {};
  }, [isVisible]);

  const startVideo = async () => {
    if (!socket) return alert('Socket not connected');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      // Add local video element
      const localVideo = document.createElement('video');
      localVideo.autoplay = true;
      localVideo.muted = true;
      localVideo.playsInline = true;
      localVideo.srcObject = stream;
      localVideo.className = 'rounded-md shadow-lg';
      localVideo.style.width = '180px';
      localVideo.style.height = '120px';
      document.body.appendChild(localVideo);
      videoElementsRef.current[socket.id || 'local'] = localVideo;

      // Join the voice/video room on the server (server uses same events)
      socket.emit('join-voice-chat', { roomCode, username });
      setIsActive(true);

      // Setup socket listeners for signaling
      socket.on('user-joined-voice', payload => {
        // payload.callerID is the newly joined user (we are existing user)
        if (payload.callerID === socket.id) return;
        // create peer as initiator to that user
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peersRef.current[payload.callerID] = peer;

        peer.on('signal', signal => {
          socket.emit('sending-signal', { userToCall: payload.callerID, callerID: socket.id, signal });
        });

        peer.on('stream', remoteStream => {
          attachRemoteStream(payload.callerID, remoteStream);
        });
      });

      socket.on('receiving-signal', payload => {
        // incoming call: payload.callerID is who called us
        if (payload.callerID === socket.id) return;
        const peer = new Peer({ initiator: false, trickle: false, stream });
        peersRef.current[payload.callerID] = peer;

        peer.on('signal', signal => {
          socket.emit('returning-signal', { signal, callerID: payload.callerID });
        });

        peer.on('stream', remoteStream => {
          attachRemoteStream(payload.callerID, remoteStream);
        });

        peer.signal(payload.signal);
      });

      socket.on('receiving-returned-signal', payload => {
        const item = peersRef.current[payload.id];
        if (item) item.signal(payload.signal);
      });

      socket.on('user-left-voice', payload => {
        // remote user left; cleanup
        const id = payload.callerID;
        if (peersRef.current[id]) {
          peersRef.current[id].destroy();
          delete peersRef.current[id];
        }
        if (videoElementsRef.current[id]) {
          const v = videoElementsRef.current[id];
          v.pause();
          v.srcObject = null;
          if (v.parentNode) v.parentNode.removeChild(v);
          delete videoElementsRef.current[id];
        }
      });

    } catch (err) {
      console.error('Failed to start video:', err);
      alert('Could not access camera/microphone. Check permissions.');
    }
  };

  const attachRemoteStream = (id, remoteStream) => {
    if (videoElementsRef.current[id]) return; // already added
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = remoteStream;
    video.style.width = '240px';
    video.style.height = '160px';
    video.className = 'rounded-md shadow-lg';
    document.body.appendChild(video);
    videoElementsRef.current[id] = video;
  };

  const stopVideo = () => {
    // stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // destroy peers
    Object.values(peersRef.current).forEach(p => p.destroy());
    peersRef.current = {};

    // remove video elements
    Object.values(videoElementsRef.current).forEach(v => {
      try { v.pause(); if (v.parentNode) v.parentNode.removeChild(v); } catch(e) {}
    });
    videoElementsRef.current = {};

    // tell server we left
    if (socket) socket.emit('leave-voice-chat', { roomCode });

    setIsActive(false);
  };

  const handleClose = () => {
    stopVideo();
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-6 w-full max-w-3xl text-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Video Chat</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="px-3 py-1 rounded bg-gray-800">Close</button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-300">This uses the server&apos;s existing peer signaling. For small groups, mesh calling works well. If you can&apos;t access camera or microphone, ensure your browser permissions are enabled.</p>

          <div className="flex gap-3">
            {!isActive ? (
              <button onClick={startVideo} className="bg-purple-600 px-4 py-2 rounded">Start Video Call</button>
            ) : (
              <button onClick={stopVideo} className="bg-red-600 px-4 py-2 rounded">Stop</button>
            )}
            <button onClick={handleClose} className="bg-gray-700 px-4 py-2 rounded">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
