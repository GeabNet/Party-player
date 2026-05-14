import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ServerStatus from '../components/ServerStatus';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../utils/urls';

export default function Home() {
  const { user, userProfile, signOut, loading, sessionRestored } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (sessionRestored && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, sessionRestored, router]);

  const profile = userProfile || (user && {
    display_name: user.email?.split('@')[0] || 'User',
    username: user.email?.split('@')[0] || 'user',
    avatar_url: getAvatarUrl(user.email?.charAt(0).toUpperCase() || 'U'),
  });

  const createRoom = async () => {
    if (!user || !profile) {
      setError('You must be logged in to create a room.');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.roomCode) {
        const params = new URLSearchParams({
          username: profile.display_name,
          avatar: encodeURIComponent(profile.avatar_url),
        });
        router.push(`/r/${data.roomCode}?${params.toString()}`);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Couldn’t reach the server. Check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!user || !profile) {
      setError('You must be logged in to join a room.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Enter a room code first.');
      return;
    }

    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/room/${roomCode.toUpperCase()}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          const params = new URLSearchParams({
            username: profile.display_name,
            avatar: encodeURIComponent(profile.avatar_url),
          });
          router.push(`/r/${roomCode.toUpperCase()}?${params.toString()}`);
        } else {
          setError('Room not found. Check the code.');
        }
      } else {
        setError('Room not found. Check the code.');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Couldn’t reach the server.');
    }
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') action();
  };

  if (loading || (user && !userProfile)) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-ink-2 text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-ink-3 border-t-accent rounded-full animate-spin" />
          <p className="text-sm">{!user ? 'Loading…' : 'Loading your profile…'}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Party Player · Watch Together</title>
        <meta name="description" content="Create or join a watch party for synchronized YouTube viewing." />
        <meta name="theme-color" content="#0A0A0B" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div className="page">
        <ServerStatus />

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-1/80 backdrop-blur border-b border-line">
          <div className="page-shell flex items-center justify-between py-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent grid place-items-center text-white font-bold text-sm">P</div>
              <span className="font-semibold tracking-tight">Party Player</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/friends" className="btn-ghost hidden sm:inline-flex">
                <i className="bi bi-people-fill" />
                <span>Friends</span>
              </Link>
              <Link href="/profile">
                <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-surface-3 transition cursor-pointer">
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-8 h-8 rounded-full object-cover border border-line"
                  />
                  <span className="text-sm font-medium hidden sm:block">{profile.display_name}</span>
                </div>
              </Link>
              <button onClick={signOut} className="btn-ghost" aria-label="Sign out">
                <i className="bi bi-box-arrow-right" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="page-shell">
          <section className="pt-10 pb-8 sm:pt-14 sm:pb-12 text-center max-w-2xl mx-auto animate-fade-in-up">
            <span className="chip chip-accent mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Welcome back, {profile.display_name}
            </span>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
              Watch YouTube together,
              <br />
              <span className="text-ink-2">in perfect sync.</span>
            </h1>
            <p className="text-ink-2 mt-4 text-base sm:text-lg">
              Create a room and invite friends — playback, pauses, and seeks stay in step for everyone.
            </p>
          </section>

          {/* Actions */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div className="surface-card p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent grid place-items-center">
                  <i className="bi bi-plus-lg text-xl" />
                </div>
                <div>
                  <h3 className="font-semibold">Create a room</h3>
                  <p className="text-xs text-ink-2">Start a new watch party and share the code.</p>
                </div>
              </div>
              <button
                onClick={createRoom}
                disabled={isCreating}
                className="btn-primary btn-lg w-full"
              >
                {isCreating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  <>
                    <i className="bi bi-arrow-right" />
                    New Room
                  </>
                )}
              </button>
            </div>

            <div className="surface-card p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-surface-3 text-ink-0 grid place-items-center border border-line">
                  <i className="bi bi-arrow-right-square text-xl" />
                </div>
                <div>
                  <h3 className="font-semibold">Join a room</h3>
                  <p className="text-xs text-ink-2">Got a code? Enter it below.</p>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  onKeyPress={(e) => handleKeyPress(e, joinRoom)}
                  placeholder="ABC123"
                  maxLength={6}
                  className="input input-lg text-center tracking-[0.4em] font-mono uppercase"
                />
                <button
                  onClick={joinRoom}
                  disabled={!roomCode.trim()}
                  className="btn-secondary btn-lg w-full"
                >
                  <i className="bi bi-box-arrow-in-right" />
                  Join Room
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="max-w-3xl mx-auto mt-4 p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm text-center">
              {error}
            </div>
          )}

          {/* Features strip */}
          <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            <Feature icon="bi-play-fill" title="Synced playback" desc="Pause, play, seek — everyone follows the host." />
            <Feature icon="bi-chat-dots" title="Live chat" desc="Real-time messages in every room." />
            <Feature icon="bi-people-fill" title="Friends & invites" desc="Add friends and send room invites instantly." />
          </section>

          <footer className="text-center text-xs text-ink-3 mt-12 mb-6">
            Built for synced entertainment · v1
          </footer>
        </main>
      </div>
    </>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="surface-flat p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-lg bg-surface-3 border border-line grid place-items-center text-accent shrink-0">
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ink-2 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
