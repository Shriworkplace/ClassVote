// ClassVote Offline Vault Utility
// Stores offline ballots, local election state, and handles bulk synchronization

const OFFLINE_BALLOTS_KEY = 'classvote_offline_ballots';
const OFFLINE_VOTED_KEY = 'classvote_offline_voted_students';
const CACHED_ELECTION_DATA_KEY = 'classvote_cached_election';

export const offlineVault = {
  // Get all pending offline ballots
  getPendingBallots: () => {
    try {
      const data = localStorage.getItem(OFFLINE_BALLOTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Get count of pending ballots
  getPendingCount: () => {
    return offlineVault.getPendingBallots().length;
  },

  // Check if voter has already voted in this offline booth session
  isVoterLocallyVoted: (enrollmentNo, email) => {
    try {
      const raw = localStorage.getItem(OFFLINE_VOTED_KEY);
      const votedSet = raw ? JSON.parse(raw) : [];
      const cleanEnNo = (enrollmentNo || '').trim().toUpperCase();
      const cleanEmail = (email || '').trim().toLowerCase();

      return votedSet.some(item => 
        (cleanEnNo && item.enrollmentNo === cleanEnNo) ||
        (cleanEmail && item.email === cleanEmail)
      );
    } catch {
      return false;
    }
  },

  // Save an offline ballot securely
  saveOfflineBallot: ({ voter, selections, isKiosk = false }) => {
    try {
      const ballots = offlineVault.getPendingBallots();
      const isKioskBallot = isKiosk || !voter?.name;
      const newBallot = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        voter: {
          name: voter?.name || 'In-Person Booth Voter',
          enrollmentNo: voter?.enrollmentNo || '',
          email: voter?.email || ''
        },
        selections: selections || {},
        timestamp: new Date().toISOString(),
        channel: isKioskBallot ? 'manual_kiosk' : 'offline_sync',
        isKiosk: isKioskBallot
      };

      ballots.push(newBallot);
      localStorage.setItem(OFFLINE_BALLOTS_KEY, JSON.stringify(ballots));

      // Mark student as voted in local storage if identified
      if (voter?.enrollmentNo || voter?.email) {
        const rawVoted = localStorage.getItem(OFFLINE_VOTED_KEY);
        const votedSet = rawVoted ? JSON.parse(rawVoted) : [];
        votedSet.push({
          enrollmentNo: (voter.enrollmentNo || '').trim().toUpperCase(),
          email: (voter.email || '').trim().toLowerCase(),
          name: voter.name,
          timestamp: newBallot.timestamp
        });
        localStorage.setItem(OFFLINE_VOTED_KEY, JSON.stringify(votedSet));
      }

      // Trigger custom event so reactive UI badges update immediately
      window.dispatchEvent(new CustomEvent('classvote_vault_updated', { detail: { count: ballots.length } }));

      return { success: true, ballotId: newBallot.id, pendingCount: ballots.length };
    } catch (err) {
      console.error('Failed to store ballot offline:', err);
      return { success: false, error: 'Local storage error' };
    }
  },

  // Cache election positions and roster for offline polling booth capability
  cacheElectionData: ({ positions, eligibleVoters }) => {
    try {
      const cache = {
        positions: positions || [],
        eligibleVoters: eligibleVoters || [],
        cachedAt: new Date().toISOString()
      };
      localStorage.setItem(CACHED_ELECTION_DATA_KEY, JSON.stringify(cache));
    } catch (err) {
      console.error('Failed to cache election data:', err);
    }
  },

  // Retrieve cached election data when offline
  getCachedElectionData: () => {
    try {
      const raw = localStorage.getItem(CACHED_ELECTION_DATA_KEY);
      return raw ? JSON.parse(raw) : { positions: [], eligibleVoters: [] };
    } catch {
      return { positions: [], eligibleVoters: [] };
    }
  },

  // Clear ballots after successful backend sync
  clearPendingBallots: () => {
    try {
      localStorage.removeItem(OFFLINE_BALLOTS_KEY);
      window.dispatchEvent(new CustomEvent('classvote_vault_updated', { detail: { count: 0 } }));
    } catch (err) {
      console.error('Failed to clear pending ballots:', err);
    }
  }
};
