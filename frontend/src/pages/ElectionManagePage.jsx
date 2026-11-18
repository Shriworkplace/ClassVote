import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import {
  ArrowLeft, Settings, Users, UserPlus, Clock, Trash2, Download,
  RefreshCw, Plus, FileSpreadsheet, Mail, Hash, User, AlertCircle, Monitor,
  ShieldCheck, CheckCircle2, Pencil, Check, X, Copy, Globe, ExternalLink, Loader2, Code
} from 'lucide-react';
import Alert from '../components/Alert';
import { offlineVault } from '../utils/offlineVault';
import { usePageMeta } from '../utils/usePageMeta';

const ElectionManagePage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();

  const [election, setElection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminResults, setAdminResults] = useState([]);
  const [voteLogs, setVoteLogs] = useState([]);
  const [eligibleVoters, setEligibleVoters] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Settings controls
  const [startTime, setStartTime] = useState(null);
  const [closeTime, setCloseTime] = useState(null);

  usePageMeta({
    title: election ? `Manage: ${election.title}` : 'Manage Election',
    description: 'Organizer console for managing positions, candidates, and real-time turnout.',
    robots: 'noindex, nofollow'
  });
  const [expectedVotersInput, setExpectedVotersInput] = useState('');

  // Position / Candidate forms
  const [posName, setPosName] = useState('');
  const [candPos, setCandPos] = useState('');
  const [candName, setCandName] = useState('');
  const [candPhoto, setCandPhoto] = useState('');
  const [candPhotoFile, setCandPhotoFile] = useState(null);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [editingCandidateName, setEditingCandidateName] = useState('');
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);

  // Roster Management
  const [rosterMode, setRosterMode] = useState('form');
  const [voterName, setVoterName] = useState('');
  const [voterEnrollmentNo, setVoterEnrollmentNo] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [rosterFile, setRosterFile] = useState(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [isSubmittingRoster, setIsSubmittingRoster] = useState(false);

  // Offline Vault count for this election
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  const showMessage = useCallback((msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 4500);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [elRes, resRes, logsRes, rosterRes] = await Promise.all([
        fetch(`/api/elections/${electionId}`),
        fetch(`/api/elections/${electionId}/results`),
        fetch(`/api/elections/${electionId}/votes-log`),
        fetch(`/api/elections/${electionId}/roster`)
      ]);

      if (elRes.status === 404 || elRes.status === 403) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (elRes.ok) {
        const elData = await elRes.json();
        setElection(elData);
        setStartTime(elData.scheduledStartTime ? new Date(elData.scheduledStartTime) : null);
        setCloseTime(elData.scheduledCloseTime ? new Date(elData.scheduledCloseTime) : null);
        setExpectedVotersInput(elData.expectedVoters ? String(elData.expectedVoters) : '');
        setOfflinePendingCount(offlineVault.getPendingCount(elData.slug));
      }
      if (resRes.ok) {
        const resultsData = await resRes.json();
        setAdminResults(resultsData);
        setCandPos((prev) => prev || resultsData[0]?.positionId || '');
      }
      if (logsRes.ok) setVoteLogs(await logsRes.json());
      if (rosterRes.ok) setEligibleVoters(await rosterRes.json());
    } catch {
      showMessage('Error loading election data.', true);
    } finally {
      setIsLoading(false);
    }
  }, [electionId, navigate, showMessage]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!election?._id) return;
    const socket = io();
    socket.emit('join-election', election._id);
    socket.on('results-updated', loadAll);
    socket.on('positions-updated', loadAll);
    socket.on('status-updated', loadAll);

    const handleVault = () => {
      setOfflinePendingCount(offlineVault.getPendingCount(election.slug));
    };
    window.addEventListener('classvote_vault_updated', handleVault);

    return () => {
      socket.emit('leave-election', election._id);
      socket.disconnect();
      window.removeEventListener('classvote_vault_updated', handleVault);
    };
  }, [election?._id, election?.slug, loadAll]);

  const updateElectionSettings = async (updates, successMsg = 'Settings updated') => {
    try {
      const res = await fetch(`/api/elections/${electionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (res.ok) {
        setElection(data);
        showMessage(successMsg);
      } else {
        showMessage(data.error || 'Failed to update settings', true);
      }
    } catch {
      showMessage('Network error updating settings', true);
    }
  };

  const handleAddPosition = async (e) => {
    e.preventDefault();
    if (!posName.trim()) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: posName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setPosName('');
        showMessage('Position added');
        loadAll();
      } else {
        showMessage(data.error || 'Failed to add position', true);
      }
    } catch {
      showMessage('Error adding position', true);
    }
  };

  const handleDeletePosition = async (posId) => {
    if (!window.confirm('Remove this position and all its candidates and votes?')) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/positions/${posId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Position removed');
        loadAll();
      } else {
        showMessage('Failed to delete position', true);
      }
    } catch {
      showMessage('Error deleting position', true);
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!candPos || !candName.trim()) return;
    try {
      let finalPhotoUrl = candPhoto.trim();
      if (candPhotoFile) {
        const formData = new FormData();
        formData.append('photo', candPhotoFile);
        const upRes = await fetch(`/api/elections/${electionId}/upload-photo`, {
          method: 'POST',
          body: formData
        });
        if (!upRes.ok) {
          showMessage('Photo upload failed', true);
          return;
        }
        const upData = await upRes.json();
        finalPhotoUrl = upData.photoUrl;
      }

      const res = await fetch(`/api/elections/${electionId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: candPos, name: candName.trim(), photoUrl: finalPhotoUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setCandName('');
        setCandPhoto('');
        setCandPhotoFile(null);
        showMessage('Candidate registered');
        loadAll();
      } else {
        showMessage(data.error || 'Failed to add candidate', true);
      }
    } catch {
      showMessage('Error adding candidate', true);
    }
  };

  const handleSaveEditCandidate = async (candId) => {
    const trimmed = editingCandidateName.trim();
    if (!trimmed) {
      showMessage('Candidate name cannot be empty', true);
      return;
    }
    setIsSavingCandidate(true);
    try {
      const res = await fetch(`/api/elections/${electionId}/candidates/${candId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingCandidateId(null);
        setEditingCandidateName('');
        showMessage('Candidate name updated');
        loadAll();
      } else {
        showMessage(data.error || 'Failed to update candidate', true);
      }
    } catch {
      showMessage('Error updating candidate', true);
    } finally {
      setIsSavingCandidate(false);
    }
  };

  const handleDeleteCandidate = async (candId) => {
    if (!window.confirm('Remove this candidate?')) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/candidates/${candId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Candidate removed');
        loadAll();
      } else {
        showMessage('Failed to remove candidate', true);
      }
    } catch {
      showMessage('Error removing candidate', true);
    }
  };

  const handleAddSingleVoter = async (e) => {
    e.preventDefault();
    if (!voterName.trim() || (!voterEnrollmentNo.trim() && !voterEmail.trim())) {
      showMessage('Enter Full Name plus Enrollment/ID or Email', true);
      return;
    }
    setIsSubmittingRoster(true);
    try {
      const res = await fetch(`/api/elections/${electionId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voters: [{ name: voterName.trim(), enrollmentNo: voterEnrollmentNo.trim(), email: voterEmail.trim() }]
        })
      });
      const data = await res.json();
      if (res.ok) {
        setVoterName('');
        setVoterEnrollmentNo('');
        setVoterEmail('');
        showMessage(data.message || 'Voter added to roster');
        loadAll();
      } else {
        showMessage(data.error || 'Failed to add voter', true);
      }
    } catch {
      showMessage('Error adding voter', true);
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleUploadRosterCsv = async (e) => {
    e.preventDefault();
    if (!rosterFile) return;
    setIsSubmittingRoster(true);
    try {
      const formData = new FormData();
      formData.append('file', rosterFile);
      const res = await fetch(`/api/elections/${electionId}/upload-roster`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setRosterFile(null);
        showMessage(data.message || 'Roster CSV imported');
        loadAll();
      } else {
        showMessage(data.error || 'CSV import failed', true);
      }
    } catch {
      showMessage('Error uploading CSV', true);
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleDeleteVoter = async (voterId) => {
    if (!window.confirm('Remove this voter from the eligible roster?')) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/roster/${voterId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Voter removed from roster');
        loadAll();
      }
    } catch {
      showMessage('Error removing voter', true);
    }
  };

  const handleSyncOfflineVotes = async () => {
    if (!election?.slug) return;
    const pending = offlineVault.getPendingBallots(election.slug);
    if (pending.length === 0) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/sync-offline-votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ballots: pending })
      });
      const data = await res.json();
      if (res.ok) {
        offlineVault.clearPendingBallots(election.slug);
        setOfflinePendingCount(0);
        showMessage(data.message || 'Offline ballots synced');
        loadAll();
      } else {
        showMessage(data.error || 'Sync failed', true);
      }
    } catch {
      showMessage('Network error during offline sync', true);
    }
  };

  const handleExportLogsCsv = () => {
    const sanitizeCsvCell = (raw) => {
      const str = String(raw ?? '');
      const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${neutralized.replace(/"/g, '""')}"`;
    };
    const header = ['Voter Name', 'Enrollment/ID', 'Email', 'Channel', 'Voted At'];
    const rows = voteLogs.map((l) => [
      sanitizeCsvCell(l.voterName || ''),
      sanitizeCsvCell(l.voterEnrollmentNo || ''),
      sanitizeCsvCell(l.voterEmail || ''),
      sanitizeCsvCell(l.channel || 'online'),
      sanitizeCsvCell(l.votedAt ? format(new Date(l.votedAt), 'yyyy-MM-dd HH:mm:ss') : '')
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${election?.slug || 'election'}-turnout-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetVotes = async () => {
    if (!window.confirm('Reset ALL cast ballots for this election? Positions, candidates, and roster will be kept.')) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/votes`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('All cast ballots reset.');
        loadAll();
      } else {
        showMessage('Failed to reset ballots', true);
      }
    } catch {
      showMessage('Error resetting ballots', true);
    }
  };

  const handleDeleteElection = async () => {
    if (!window.confirm(`Permanently delete "${election?.title}" and ALL its data? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/elections/${electionId}`, { method: 'DELETE' });
      if (res.ok) {
        navigate('/dashboard', { replace: true });
      } else {
        showMessage('Failed to delete election', true);
      }
    } catch {
      showMessage('Error deleting election', true);
    }
  };

  if (isLoading || !election) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-cyan-400" />
        <span className="text-xs font-mono text-slate-400">Loading election console...</span>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/e/${election.slug}`;
  const embedSnippet = `<iframe src="${window.location.origin}/e/${election.slug}/embed" width="100%" height="240" frameborder="0" style="border:none;border-radius:16px;max-width:540px;" title="${election.title}"></iframe>\n<p style="font-size:12px;color:#94a3b8;margin-top:6px;">Live vote tracking powered by <a href="${window.location.origin}" target="_blank" rel="noopener" style="color:#06b6d4;text-decoration:none;">ClassVote</a></p>`;
  const filteredRoster = eligibleVoters.filter((v) => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (v.name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.enrollmentNo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-16 space-y-8">
      {/* Top Bar */}
      <div className="glass-panel p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Elections</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
              {election.title}
            </h1>
            <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${
              election.isCurrentlyOpen
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-white/[0.08]'
            }`}>
              {election.isCurrentlyOpen ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
          {election.organization && <p className="text-xs text-slate-400">{election.organization}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(publicUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copiedLink ? 'Copied!' : `/e/${election.slug}`}</span>
          </button>

          <Link
            to={`/e/${election.slug}/kiosk`}
            className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Launch Kiosk</span>
          </Link>

          <Link
            to={`/e/${election.slug}/results`}
            className="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Public Results</span>
          </Link>
        </div>
      </div>

      {error && <Alert message={error} type="error" />}
      {success && <Alert message={success} type="success" />}

      {/* Offline Vault Pending Banner */}
      {offlinePendingCount > 0 && (
        <div className="glass-panel p-4 border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>
              <strong>{offlinePendingCount}</strong> offline ballot(s) cached on this device for <code>/e/{election.slug}</code>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSyncOfflineVotes}
            className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Offline Ballots Now</span>
          </button>
        </div>
      )}

      {/* Controls & QR Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Election State & Schedule */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-heading font-bold text-white">Election Controls & Access Mode</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateElectionSettings({ votingOpen: !election.votingOpen }, election.votingOpen ? 'Voting closed' : 'Voting opened!')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                election.votingOpen
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-950/60 border-white/[0.08] text-slate-300 hover:border-cyan-500/30'
              }`}
            >
              <div>
                <div className="text-xs font-mono uppercase tracking-wider opacity-80">Polling Window</div>
                <div className="text-base font-heading font-extrabold mt-0.5">
                  {election.votingOpen ? 'Voting is OPEN' : 'Voting is CLOSED'}
                </div>
              </div>
              <CheckCircle2 className={`w-6 h-6 ${election.votingOpen ? 'text-emerald-400' : 'text-slate-600'}`} />
            </button>

            <button
              type="button"
              onClick={() => updateElectionSettings({ resultsPublished: !election.resultsPublished }, election.resultsPublished ? 'Results hidden' : 'Results published to public!')}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                election.resultsPublished
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                  : 'bg-slate-950/60 border-white/[0.08] text-slate-300 hover:border-cyan-500/30'
              }`}
            >
              <div>
                <div className="text-xs font-mono uppercase tracking-wider opacity-80">Public Standings</div>
                <div className="text-base font-heading font-extrabold mt-0.5">
                  {election.resultsPublished ? 'Results PUBLISHED' : 'Results PRIVATE'}
                </div>
              </div>
              <Globe className={`w-6 h-6 ${election.resultsPublished ? 'text-cyan-400' : 'text-slate-600'}`} />
            </button>
          </div>

          {/* Access Mode Selector */}
          <div>
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Voter Verification Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'roster', title: 'Roster Verified', desc: 'Must match uploaded list', icon: ShieldCheck },
                { id: 'open', title: 'Open Link', desc: '1 vote per Email/ID', icon: Globe },
                { id: 'kiosk_only', title: 'Kiosk Only', desc: 'In-person booth only', icon: Monitor }
              ].map((m) => {
                const Icon = m.icon;
                const active = election.accessMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateElectionSettings({ accessMode: m.id }, `Access mode set to ${m.title}`)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-slate-950/60 border-white/[0.08] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                      <span className="text-xs font-heading font-bold">{m.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule & Expected Turnout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Scheduled Open
              </label>
              <DatePicker
                selected={startTime}
                onChange={(date) => setStartTime(date)}
                showTimeSelect
                dateFormat="MMM d, h:mm aa"
                placeholderText="Manual toggle"
                isClearable
                className="glass-input text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Scheduled Close
              </label>
              <DatePicker
                selected={closeTime}
                onChange={(date) => setCloseTime(date)}
                showTimeSelect
                dateFormat="MMM d, h:mm aa"
                placeholderText="Manual toggle"
                isClearable
                className="glass-input text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Expected Voters</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={expectedVotersInput}
                  onChange={(e) => setExpectedVotersInput(e.target.value)}
                  placeholder="0"
                  className="glass-input text-xs py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateElectionSettings({
                      scheduledStartTime: startTime ? startTime.toISOString() : null,
                      scheduledCloseTime: closeTime ? closeTime.toISOString() : null,
                      expectedVoters: Number(expectedVotersInput) || 0
                    }, 'Schedule & target saved')
                  }
                  className="btn-primary px-3 py-2 text-xs flex-shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shareable QR Panel */}
        <div className="glass-panel p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-cyan-300">Voter QR Code</div>
          <div className="bg-white p-3.5 rounded-2xl shadow-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`}
              alt="Voter Portal QR"
              className="w-44 h-44"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-300 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-white/[0.08] break-all w-full">
            {publicUrl}
          </div>
          <div className="flex items-center justify-between w-full text-xs">
            <Link to={`/e/${election.slug}`} className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Open Voter Portal &rarr;
            </Link>
            <Link to={`/e/${election.slug}/embed`} target="_blank" className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono text-[11px]">
              <ExternalLink className="w-3 h-3" /> Preview Widget
            </Link>
          </div>

          {/* Embed snippet box for external blogs & student sites */}
          <div className="w-full pt-3 border-t border-white/[0.08] text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono text-slate-300 flex items-center gap-1">
                <Code className="w-3 h-3 text-cyan-400" /> Embed Widget & Backlink
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(embedSnippet);
                  setCopiedEmbed(true);
                  setTimeout(() => setCopiedEmbed(false), 2000);
                }}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                {copiedEmbed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEmbed ? 'Copied HTML!' : 'Copy Embed HTML'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Embed a live turnout tracker on your student union website, newspaper, or club portal with an automatic ClassVote link.
            </p>
          </div>
        </div>
      </div>

      {/* Add Position & Add Candidate Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-base font-heading font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" /> Add Election Position / Office
          </h3>
          <form onSubmit={handleAddPosition} className="flex gap-2.5">
            <input
              type="text"
              required
              value={posName}
              onChange={(e) => setPosName(e.target.value)}
              placeholder="e.g. President, Secretary, Sports Head"
              className="glass-input flex-1 text-sm"
            />
            <button type="submit" className="btn-primary px-5 py-2.5 text-xs flex-shrink-0">
              Add Office
            </button>
          </form>
        </div>

        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-base font-heading font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan-400" /> Register Candidate
          </h3>
          <form onSubmit={handleAddCandidate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                required
                value={candPos}
                onChange={(e) => setCandPos(e.target.value)}
                className="glass-input text-sm bg-slate-900"
              >
                <option value="">Select Position...</option>
                {adminResults.map((p) => (
                  <option key={p.positionId} value={p.positionId}>{p.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                value={candName}
                onChange={(e) => setCandName(e.target.value)}
                placeholder="Candidate Full Name"
                className="glass-input text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
              <input
                type="url"
                value={candPhoto}
                onChange={(e) => setCandPhoto(e.target.value)}
                placeholder="Photo URL (optional)"
                className="glass-input text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCandPhotoFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-cyan-300 w-full"
                />
                <button type="submit" className="btn-primary px-4 py-2 text-xs flex-shrink-0">
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Live Standings & Candidate Management */}
      <div className="glass-panel p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-xl font-heading font-extrabold text-white">Live Standings & Offices</h2>
            <p className="text-xs text-slate-400">Real-time tallies per office. Click the pencil icon to fix any candidate name typo live.</p>
          </div>
          <button type="button" onClick={loadAll} className="btn-secondary px-3 py-2 text-xs inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {adminResults.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">
            No positions configured yet. Add your first office above to begin.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {adminResults.map((pos) => (
              <div key={pos.positionId} className="bg-slate-950/60 rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col">
                <div className="bg-slate-900/80 px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
                  <div>
                    <h4 className="font-heading font-bold text-cyan-300 text-base">{pos.name}</h4>
                    <div className="text-xs font-mono text-slate-400 tabular-nums">
                      Total Ballots: <span className="text-white font-bold">{pos.totalVotes}</span>
                      {election.expectedVoters > 0 && (
                        <span className="text-cyan-300 ml-1.5">
                          / {election.expectedVoters} ({Math.round((pos.totalVotes / election.expectedVoters) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePosition(pos.positionId)}
                    className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10"
                    title="Delete Position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                  {[...pos.candidates].sort((a, b) => b.votes - a.votes).map((c) => {
                    const percent = pos.totalVotes > 0 ? Math.round((c.votes / pos.totalVotes) * 100) : 0;
                    const isEditing = editingCandidateId === c.candidateId;
                    return (
                      <div key={c.candidateId} className="flex flex-col items-center bg-slate-900/50 rounded-xl p-3 relative border border-white/[0.05] hover:border-cyan-500/30 transition-all group">
                        {!isEditing && (
                          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCandidateId(c.candidateId);
                                setEditingCandidateName(c.name);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 p-1 bg-slate-950/80 rounded-full border border-white/[0.08]"
                              title="Edit Candidate Name"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(c.candidateId)}
                              className="text-red-400 hover:text-red-300 p-1 bg-slate-950/80 rounded-full border border-white/[0.08]"
                              title="Delete Candidate"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <img
                          src={c.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0d172e&color=22d3ee`}
                          className="w-14 h-14 rounded-full object-cover mb-2 border border-white/[0.1]"
                          alt={c.name}
                        />

                        {isEditing ? (
                          <div className="w-full space-y-1.5">
                            <input
                              type="text"
                              value={editingCandidateName}
                              onChange={(e) => setEditingCandidateName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditCandidate(c.candidateId);
                                if (e.key === 'Escape') {
                                  setEditingCandidateId(null);
                                  setEditingCandidateName('');
                                }
                              }}
                              disabled={isSavingCandidate}
                              autoFocus
                              className="w-full px-2 py-1 text-xs text-center bg-slate-950 border border-cyan-400/60 rounded-lg text-white"
                            />
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEditCandidate(c.candidateId)}
                                disabled={isSavingCandidate}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono inline-flex items-center gap-0.5"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCandidateId(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono inline-flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-200 text-xs font-medium text-center line-clamp-2 min-h-[2rem] flex items-center font-heading">
                            {c.name}
                          </span>
                        )}

                        <span className="font-mono font-bold text-white text-xs mt-1.5 bg-slate-950 px-2.5 py-0.5 rounded-full border border-white/[0.08] tabular-nums">
                          {c.votes} votes {pos.totalVotes > 0 ? `(${percent}%)` : ''}
                        </span>

                        {pos.totalVotes > 0 && (
                          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-white/[0.06]">
                            <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eligible Roster Management */}
      <div className="glass-panel p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" /> Eligible Voter Roster ({eligibleVoters.length})
            </h2>
            <p className="text-xs text-slate-400">
              {election.accessMode === 'roster'
                ? 'Required in Roster Verified mode: only listed voters can access the online ballot.'
                : 'Optional while in Open Link / Kiosk Only mode. Switch to Roster Verified above to enforce this list.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRosterMode('form')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${rosterMode === 'form' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' : 'bg-slate-900 text-slate-400 border-white/[0.08]'}`}
            >
              Add Voter
            </button>
            <button
              type="button"
              onClick={() => setRosterMode('csv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border inline-flex items-center gap-1 ${rosterMode === 'csv' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' : 'bg-slate-900 text-slate-400 border-white/[0.08]'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV Upload
            </button>
          </div>
        </div>

        {rosterMode === 'form' ? (
          <form onSubmit={handleAddSingleVoter} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                placeholder="Full Name *"
                className="glass-input pl-9 text-sm"
              />
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={voterEnrollmentNo}
                onChange={(e) => setVoterEnrollmentNo(e.target.value.toUpperCase())}
                placeholder="Enrollment / Roll No"
                className="glass-input pl-9 text-sm font-mono"
              />
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={voterEmail}
                onChange={(e) => setVoterEmail(e.target.value)}
                placeholder="Email Address"
                className="glass-input pl-9 text-sm"
              />
            </div>
            <button type="submit" disabled={isSubmittingRoster} className="btn-primary py-2.5 text-xs">
              {isSubmittingRoster ? 'Adding...' : 'Add to Roster'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUploadRosterCsv} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-800 file:text-cyan-300 flex-1"
            />
            <button type="submit" disabled={!rosterFile || isSubmittingRoster} className="btn-primary px-5 py-2.5 text-xs">
              {isSubmittingRoster ? 'Importing...' : 'Import CSV'}
            </button>
          </form>
        )}

        {eligibleVoters.length > 0 && (
          <div className="space-y-3">
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Search roster by name, enrollment no, or email..."
              className="glass-input text-xs py-2 max-w-sm"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Enrollment / ID</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredRoster.map((v) => (
                    <tr key={v._id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-4 text-slate-200 font-medium">{v.name}</td>
                      <td className="py-2 px-4 font-mono text-cyan-300">{v.enrollmentNo || '-'}</td>
                      <td className="py-2 px-4 font-mono text-slate-400">{v.email || '-'}</td>
                      <td className="py-2 px-4 text-right">
                        <button type="button" onClick={() => handleDeleteVoter(v._id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Turnout Log & Danger Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-heading font-bold text-white">Voter Turnout Log ({voteLogs.length})</h3>
              <p className="text-[11px] text-slate-400">Secret ballot protected: records attendance only, never candidate choices.</p>
            </div>
            {voteLogs.length > 0 && (
              <button type="button" onClick={handleExportLogsCsv} className="btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>

          {voteLogs.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">No ballots cast yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Voter</th>
                    <th className="py-2 px-3">ID / Email</th>
                    <th className="py-2 px-3">Channel</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {voteLogs.map((l) => (
                    <tr key={l._id}>
                      <td className="py-2 px-3 text-slate-200">{l.voterName}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{l.voterEnrollmentNo !== '-' ? l.voterEnrollmentNo : l.voterEmail}</td>
                      <td className="py-2 px-3 font-mono text-cyan-300 text-[10px]">{l.channel}</td>
                      <td className="py-2 px-3 font-mono text-slate-400 text-[10px]">
                        {l.votedAt ? format(new Date(l.votedAt), 'MMM d, HH:mm') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="glass-panel p-6 border border-red-500/25 space-y-4">
          <h3 className="text-base font-heading font-bold text-red-400">Danger Zone</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use these actions carefully. Resetting ballots clears all votes while keeping positions and candidates.
          </p>
          <button
            type="button"
            onClick={handleResetVotes}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-heading font-bold transition-colors"
          >
            Reset All Cast Ballots
          </button>
          <button
            type="button"
            onClick={handleDeleteElection}
            className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-heading font-bold transition-colors"
          >
            Delete Election Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

export default ElectionManagePage;
