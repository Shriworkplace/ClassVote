import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { offlineVault } from '../utils/offlineVault';

const NetworkStatusBadge = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(offlineVault.getPendingCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleVaultUpdate = (e) => {
      setPendingCount(e.detail?.count ?? offlineVault.getPendingCount());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('classvote_vault_updated', handleVaultUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('classvote_vault_updated', handleVaultUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || pendingCount === 0 || !isOnline) return;

    try {
      setIsSyncing(true);
      const ballots = offlineVault.getPendingBallots();
      const res = await fetch('/api/admin/sync-offline-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ballots })
      });

      if (res.ok) {
        const data = await res.json();
        offlineVault.clearPendingBallots();
        setPendingCount(0);
        setSyncMessage(`Synced ${data.syncedCount} ballots!`);
        setTimeout(() => setSyncMessage(''), 4000);
      } else {
        const err = await res.json();
        setSyncMessage(err.error || 'Sync failed');
        setTimeout(() => setSyncMessage(''), 4000);
      }
    } catch {
      setSyncMessage('Sync failed. Check connection.');
      setTimeout(() => setSyncMessage(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no pending ballots and no sync message, render nothing
  if (isOnline && pendingCount === 0 && !syncMessage) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5 animate-fadeIn font-mono text-xs">
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 backdrop-blur-md shadow-lg">
          <WifiOff className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>Offline Mode Active (Votes Stored Locally)</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 backdrop-blur-md shadow-lg">
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{pendingCount} Pending Offline {pendingCount === 1 ? 'Ballot' : 'Ballots'}</span>
          {isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="ml-1 text-[11px] uppercase font-bold underline hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}

      {syncMessage && (
        <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] backdrop-blur-md">
          {syncMessage}
        </div>
      )}
    </div>
  );
};

export default NetworkStatusBadge;
