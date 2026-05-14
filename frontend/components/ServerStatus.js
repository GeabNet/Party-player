import { useState, useEffect } from 'react';

export default function ServerStatus() {
  const [status, setStatus] = useState('checking');
  const [details, setDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkServerStatus = async () => {
    try {
      setStatus('checking');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setLastChecked(new Date());

      if (response.ok && data.status === 'ok') {
        setStatus('online');
        setDetails({
          uptime: data.uptime,
          rooms: data.rooms,
          timestamp: data.timestamp,
          responseTime: Date.now() - new Date(data.timestamp).getTime(),
        });
      } else {
        setStatus('offline');
        setDetails({ message: `Server responded with status ${response.status}` });
      }
    } catch (err) {
      setStatus('offline');
      setLastChecked(new Date());
      setDetails({
        message: err.name === 'TimeoutError'
          ? 'Timeout — server may be overloaded.'
          : err.message || 'Network error.',
      });
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatLast = (d) => {
    if (!d) return 'Never';
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const cfg =
    status === 'online' ? { dot: 'bg-success', text: 'Online' }
    : status === 'offline' ? { dot: 'bg-danger', text: 'Offline' }
    : { dot: 'bg-ink-3 animate-pulse', text: 'Checking…' };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        onClick={() => setShowDetails((v) => !v)}
        className="chip bg-surface-2 backdrop-blur hover:bg-surface-3 transition"
        title="Server status"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        Server · {cfg.text}
      </button>

      {showDetails && (
        <div className="absolute bottom-10 left-0 w-72 surface-raised p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Backend health</div>
            <button onClick={() => setShowDetails(false)} className="text-ink-3 hover:text-ink-0">
              <i className="bi bi-x-lg text-sm" />
            </button>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-ink-3">Status</span>
              <span className="font-medium">{cfg.text}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Last check</span>
              <span>{formatLast(lastChecked)}</span>
            </div>

            {status === 'online' && details && (
              <>
                <div className="flex justify-between">
                  <span className="text-ink-3">Uptime</span>
                  <span>{formatUptime(details.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Active rooms</span>
                  <span>{details.rooms}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Response</span>
                  <span>{Math.max(0, details.responseTime)}ms</span>
                </div>
              </>
            )}

            {status === 'offline' && details?.message && (
              <div className="p-2 rounded-lg bg-danger-soft border border-danger/30 text-danger text-xs mt-2">
                {details.message}
              </div>
            )}
          </div>

          <button
            onClick={checkServerStatus}
            disabled={status === 'checking'}
            className="btn-secondary w-full mt-3 py-1.5 text-xs"
          >
            {status === 'checking' ? 'Checking…' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
