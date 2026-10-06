import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert';
import { 
  Lock, LogOut, Settings, Users, UserPlus, Clock, Trash2, Download, 
  RefreshCw, Plus, FileSpreadsheet, Mail, Hash, User, AlertCircle, Monitor, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { io } from 'socket.io-client';
import { offlineVault } from '../utils/offlineVault';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [settings, setSettings] = useState({ 
    votingOpen: false, 
    resultsPublished: false,
    scheduledStartTime: null,
    scheduledCloseTime: null
  });
  
  const [positions, setPositions] = useState([]);
  const [adminResults, setAdminResults] = useState([]);
  const [voteLogs, setVoteLogs] = useState([]);
  const [eligibleVoters, setEligibleVoters] = useState([]);
  const [offlinePendingCount, setOfflinePendingCount] = useState(offlineVault.getPendingCount());
  const [expectedVotersInput, setExpectedVotersInput] = useState('');
  
  // Roster Management Form state
  const [rosterMode, setRosterMode] = useState('form'); // 'form' | 'csv'
  const [voterName, setVoterName] = useState('');
  const [voterEnrollmentNo, setVoterEnrollmentNo] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [isMultiVoterMode, setIsMultiVoterMode] = useState(false);
  const [extraVoterRows, setExtraVoterRows] = useState([]);
  const [isSubmittingRoster, setIsSubmittingRoster] = useState(false);
  const [rosterFile, setRosterFile] = useState(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [posName, setPosName] = useState('');
  const [candPos, setCandPos] = useState('');
  const [candName, setCandName] = useState('');
  const [candPhoto, setCandPhoto] = useState('');
  const [candPhotoFile, setCandPhotoFile] = useState(null);

  // Schedule state
  const [startTime, setStartTime] = useState(null);
  const [closeTime, setCloseTime] = useState(null);

  useEffect(() => {
    checkAuth();

    const socket = io();
    socket.on('results-updated', () => {
      loadDashboardData();
    });

    return () => socket.disconnect();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/results');
      if (res.ok) {
        setIsAuthenticated(true);
        loadDashboardData();
      }
    } catch (e) {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setPassword('');
        setError('');
        loadDashboardData();
      } else {
        setError('Invalid master credentials');
      }
    } catch (err) {
      setError('Authentication failed. Please retry.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  const loadDashboardData = async () => {
    try {
      const [statusRes, posRes, resultsRes, logsRes, rosterRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/positions'),
        fetch('/api/admin/results'),
        fetch('/api/admin/votes-log'),
        fetch('/api/admin/roster')
      ]);
      if (statusRes.ok) {
        const s = await statusRes.json();
        setSettings(s);
        setStartTime(s.scheduledStartTime ? new Date(s.scheduledStartTime) : null);
        setCloseTime(s.scheduledCloseTime ? new Date(s.scheduledCloseTime) : null);
        if (s.expectedVoters !== undefined) {
          setExpectedVotersInput(s.expectedVoters > 0 ? String(s.expectedVoters) : '');
        }
      }
      if (posRes.ok) setPositions(await posRes.json());
      if (resultsRes.ok) setAdminResults(await resultsRes.json());
      if (logsRes?.ok) setVoteLogs(await logsRes.json());
      if (rosterRes?.ok) setEligibleVoters(await rosterRes.json());
    } catch (e) {}
  };

  const showMessage = (msg, isErr = false) => {
    if (isErr) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 5000);
  };

  const toggleSetting = async (key) => {
    const newVal = !settings[key];
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newVal })
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: newVal }));
        showMessage(`${key} updated`);
      }
    } catch (e) {}
  };

  const updateSchedule = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scheduledStartTime: startTime,
          scheduledCloseTime: closeTime
        })
      });
      if (res.ok) {
        showMessage(`Schedule window updated`);
      }
    } catch (e) {}
  };

  const saveExpectedVoters = async () => {
    const count = parseInt(expectedVotersInput, 10);
    const validCount = isNaN(count) ? 0 : Math.max(0, count);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVoters: validCount })
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, expectedVoters: validCount }));
        showMessage(`Expected electorate set to ${validCount} voters.`);
      } else {
        showMessage('Failed to save electorate target.', true);
      }
    } catch {
      showMessage('Network error saving electorate target.', true);
    }
  };

  const handleCreateVoter = async (e) => {
    if (e) e.preventDefault();
    
    const votersToRegister = [];

    if (!isMultiVoterMode) {
      const cleanName = voterName.trim();
      const cleanEnNo = voterEnrollmentNo.trim().toUpperCase();
      const cleanEmail = voterEmail.trim().toLowerCase();

      if (!cleanName) {
        showMessage('Please enter the voter\'s full name.', true);
        return;
      }
      if (!cleanEnNo && !cleanEmail) {
        showMessage('Please enter the voter\'s Enrollment Number or Roll Number.', true);
        return;
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        showMessage('Please enter a valid email address.', true);
        return;
      }

      votersToRegister.push({
        name: cleanName,
        enrollmentNo: cleanEnNo || undefined,
        email: cleanEmail || undefined
      });
    } else {
      const allRows = [
        { name: voterName, enrollmentNo: voterEnrollmentNo, email: voterEmail },
        ...extraVoterRows
      ];

      for (let i = 0; i < allRows.length; i++) {
        const r = allRows[i];
        const rName = (r.name || '').trim();
        const rEnNo = (r.enrollmentNo || '').trim().toUpperCase();
        const rEmail = (r.email || '').trim().toLowerCase();

        if (!rName && !rEnNo && !rEmail && allRows.length > 1) {
          continue;
        }

        if (!rName) {
          showMessage(`Row #${i + 1}: Voter name is required.`, true);
          return;
        }
        if (!rEnNo && !rEmail) {
          showMessage(`Row #${i + 1} (${rName}): Enrollment No. or Roll No. is required.`, true);
          return;
        }
        if (rEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail)) {
          showMessage(`Row #${i + 1} (${rName}): Invalid email format.`, true);
          return;
        }

        votersToRegister.push({
          name: rName,
          enrollmentNo: rEnNo || undefined,
          email: rEmail || undefined
        });
      }

      if (votersToRegister.length === 0) {
        showMessage('Please enter at least one voter\'s details.', true);
        return;
      }
    }

    try {
      setIsSubmittingRoster(true);
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voters: votersToRegister })
      });

      const data = await res.json();
      if (res.ok) {
        showMessage(
          votersToRegister.length === 1
            ? `Voter "${votersToRegister[0].name}" registered successfully!`
            : `Successfully registered ${data.count || votersToRegister.length} voters!`
        );
        setVoterName('');
        setVoterEnrollmentNo('');
        setVoterEmail('');
        setExtraVoterRows([]);
        setIsMultiVoterMode(false);
        loadDashboardData();
      } else {
        showMessage(data.error || 'Failed to register voter(s)', true);
      }
    } catch {
      showMessage('Network error while saving voter roster', true);
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleUploadRosterCsv = async (e) => {
    if (e) e.preventDefault();
    if (!rosterFile) {
      showMessage('Please select a CSV roster file to upload.', true);
      return;
    }

    try {
      setIsSubmittingRoster(true);
      const formData = new FormData();
      formData.append('file', rosterFile);

      const res = await fetch('/api/admin/upload-roster', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        showMessage(`Roster synced with ${data.count} voters from CSV!`);
        setRosterFile(null);
        const fileInput = document.getElementById('roster-csv-file');
        if (fileInput) fileInput.value = '';
        loadDashboardData();
      } else {
        showMessage(data.error || 'Failed to upload CSV roster', true);
      }
    } catch {
      showMessage('File upload error. Please check the CSV file format.', true);
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleAddVoterRow = () => {
    setExtraVoterRows(prev => [...prev, { id: Date.now() + Math.random(), name: '', enrollmentNo: '', email: '' }]);
  };

  const handleUpdateExtraRow = (index, field, value) => {
    setExtraVoterRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveExtraRow = (index) => {
    setExtraVoterRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Name,Enrollment No\nAlice Smith,21BCS001\nBob Johnson,21BCS002\nCharlie Brown,21BCS003\nDiana Prince,21BCS004';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'ClassVote_Roster_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRoster = () => {
    if (eligibleVoters.length === 0) {
      showMessage('No voters on the roster to export.', true);
      return;
    }
    const headers = ['Name', 'Enrollment No', 'Email'];
    const rows = eligibleVoters.map(v => [
      `"${v.name}"`,
      `"${v.enrollmentNo || ''}"`,
      `"${v.email || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `eligible_voters_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddPosition = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: posName })
      });
      if (res.ok) {
        showMessage('Position added');
        setPosName('');
        loadDashboardData();
      }
    } catch (e) {}
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    try {
      let finalPhotoUrl = candPhoto;
      
      if (candPhotoFile) {
        const formData = new FormData();
        formData.append('photo', candPhotoFile);
        const uploadRes = await fetch('/api/admin/upload-photo', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalPhotoUrl = uploadData.url;
        } else {
          showMessage('Failed to upload candidate photo', true);
          return;
        }
      }

      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: candPos, name: candName, photoUrl: finalPhotoUrl })
      });
      if (res.ok) {
        showMessage('Candidate registered');
        setCandName('');
        setCandPhoto('');
        setCandPhotoFile(null);
        if (document.getElementById('cand-photo-file')) {
          document.getElementById('cand-photo-file').value = '';
        }
        loadDashboardData();
      }
    } catch (e) {
      showMessage('Error adding candidate', true);
    }
  };

  const handleSyncOfflineVault = async () => {
    try {
      const ballots = offlineVault.getPendingBallots();
      if (ballots.length === 0) return;
      const res = await fetch('/api/admin/sync-offline-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ballots })
      });
      if (res.ok) {
        const data = await res.json();
        offlineVault.clearPendingBallots();
        setOfflinePendingCount(0);
        showMessage(data.message || 'Offline votes successfully synced to database!');
        loadDashboardData();
      } else {
        const err = await res.json();
        showMessage(err.error || 'Failed to sync offline votes', true);
      }
    } catch {
      showMessage('Network error while syncing offline ballots', true);
    }
  };

  const handleDownloadCSV = () => {
    if (voteLogs.length === 0) {
      showMessage('No voter turnout records to export.', true);
      return;
    }
    const headers = ['Voter Name', 'Enrollment No', 'Voter Email', 'Voting Channel', 'Timestamp', 'Status'];
    const rows = voteLogs.map(log => [
      `"${log.voterName}"`,
      `"${log.voterEnrollmentNo || '-'}"`,
      `"${log.voterEmail || '-'}"`,
      `"${log.channel || 'online'}"`,
      `"${new Date(log.votedAt).toLocaleString()}"`,
      `"Ballot Cast"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `voter_turnout_log_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleDeletePosition = async (id) => {
    if (window.confirm("Are you sure you want to delete this position and all associated candidates?")) {
      try {
        const res = await fetch(`/api/admin/positions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Position removed');
          loadDashboardData();
        } else {
          showMessage('Failed to delete position', true);
        }
      } catch (e) {
        showMessage('Error deleting position', true);
      }
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (window.confirm("Are you sure you want to remove this candidate?")) {
      try {
        const res = await fetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Candidate removed');
          loadDashboardData();
        } else {
          showMessage('Failed to delete candidate', true);
        }
      } catch (e) {
        showMessage('Error deleting candidate', true);
      }
    }
  };

  const handleDeleteVoter = async (id) => {
    if (window.confirm("Are you sure you want to remove this voter from the roster?")) {
      try {
        const res = await fetch(`/api/admin/roster/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Voter removed from roster');
          loadDashboardData();
        } else {
          showMessage('Failed to remove voter', true);
        }
      } catch (e) {
        showMessage('Error removing voter', true);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel w-full max-w-sm p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="w-14 h-14 bg-slate-800/80 border border-white/[0.08] rounded-2xl mx-auto flex items-center justify-center mb-6 text-slate-300">
            <Lock className="w-6 h-6" />
          </div>
          
          <div className="badge-kicker mb-2">
            <span>Restricted Access</span>
          </div>

          <h2 className="text-2xl font-heading font-extrabold text-white mb-2 tracking-tight">Admin Console</h2>
          <p className="text-xs text-slate-400 mb-6">Enter master secret to manage elections.</p>
          
          <Alert message={error} type="error" />
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master Password"
              required
              className="glass-input text-center"
            />
            <button type="submit" className="btn-primary w-full py-3">
              Unlock Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 px-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="badge-kicker mb-1">
            <span>System Control</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight">
            Election Control Panel
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configure parameters, verify rosters, and monitor live tallies.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Link
            to="/kiosk"
            target="_blank"
            className="btn-primary !py-2 !px-3.5 !text-xs inline-flex items-center gap-1.5"
            title="Open in-person polling station for students lining up to vote"
          >
            <Monitor className="w-3.5 h-3.5" /> Launch In-Person Kiosk
          </Link>
          <button 
            onClick={handleLogout} 
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-mono font-medium transition-colors border border-white/[0.08]"
          >
            <LogOut className="w-3.5 h-3.5" /> Terminate Session
          </button>
        </div>
      </div>

      {offlinePendingCount > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-amber-400 flex-shrink-0 animate-spin" />
            <div>
              <div className="text-sm font-heading font-bold text-white">
                {offlinePendingCount} Offline Ballots Stored Locally
              </div>
              <p className="text-xs text-amber-200/80">
                Ballots recorded during internet outage are queued in the local browser vault.
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncOfflineVault}
            className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap"
          >
            Sync Ballots to Database
          </button>
        </div>
      )}

      <div className="fixed top-20 right-6 z-50 w-80">
        <Alert message={error} type="error" />
        <Alert message={success} type="success" />
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Election Settings */}
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Election Parameters</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-white/[0.06] text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Voting Portal</div>
              <div className={`text-xl font-heading font-extrabold tracking-tight ${settings.votingOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {settings.votingOpen ? 'OPEN' : 'CLOSED'}
              </div>
              <button 
                onClick={() => toggleSetting('votingOpen')} 
                className="mt-3 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs font-mono font-medium text-slate-200 transition-colors border border-white/[0.08]"
              >
                Toggle State
              </button>
            </div>
            
            <div className="bg-slate-950/60 p-4 rounded-xl border border-white/[0.06] text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Public Standings</div>
              <div className={`text-xl font-heading font-extrabold tracking-tight ${settings.resultsPublished ? 'text-emerald-400' : 'text-slate-500'}`}>
                {settings.resultsPublished ? 'PUBLISHED' : 'HIDDEN'}
              </div>
              <button 
                onClick={() => toggleSetting('resultsPublished')} 
                className="mt-3 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs font-mono font-medium text-slate-200 transition-colors border border-white/[0.08]"
              >
                Toggle Visibility
              </button>
            </div>
          </div>

          {/* QR Share Card */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Student Portal URL</div>
              <div className="text-xs font-mono text-cyan-300 break-all bg-slate-900 px-2.5 py-1 rounded border border-white/[0.06]">
                {window.location.origin}
              </div>
              <p className="text-xs text-slate-500 mt-2">Display this QR code on a projector for direct student access.</p>
            </div>
            <div className="bg-white p-2 rounded-xl flex-shrink-0 shadow-lg">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin)}`} 
                alt="QR Code" 
                className="w-20 h-20"
              />
            </div>
          </div>

          {/* Schedule Window */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-heading font-semibold text-white">Automated Schedule Window</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Start Time</label>
                <DatePicker 
                  selected={startTime} 
                  onChange={(date) => setStartTime(date)} 
                  showTimeSelect 
                  dateFormat="Pp"
                  className="glass-input !py-2 !text-xs font-mono"
                  placeholderText="Immediate"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Close Time</label>
                <DatePicker 
                  selected={closeTime} 
                  onChange={(date) => setCloseTime(date)} 
                  showTimeSelect 
                  dateFormat="Pp"
                  className="glass-input !py-2 !text-xs font-mono"
                  placeholderText="Manual Close"
                />
              </div>
            </div>
            <button 
              onClick={updateSchedule} 
              className="mt-3 w-full bg-slate-850 hover:bg-slate-800 text-slate-200 py-2 rounded-xl text-xs font-mono font-medium transition-colors border border-white/[0.08]"
            >
              Save Schedule Parameters
            </button>
          </div>

          {/* Electorate Size & Total Expected Voters */}
          <div className="pt-4 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-heading font-semibold text-white">Expected Total Voters</h4>
              </div>
              {eligibleVoters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpectedVotersInput(String(eligibleVoters.length))}
                  className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                  title="Auto-fill with count of students currently in verified roster"
                >
                  Use Roster Count ({eligibleVoters.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  value={expectedVotersInput}
                  onChange={(e) => setExpectedVotersInput(e.target.value)}
                  placeholder="Type total number of voters (e.g. 100)"
                  className="glass-input !py-2 !text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={saveExpectedVoters}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-xs font-mono font-semibold border border-cyan-500/40 transition-colors whitespace-nowrap shadow-sm"
              >
                Save Total
              </button>
            </div>

            {/* Real-time Turnout Analytics */}
            {settings.expectedVoters > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Total Turnout Progress</span>
                  <span className="text-cyan-300 font-bold">
                    {voteLogs.length} of {settings.expectedVoters} ({Math.min(100, Math.round((voteLogs.length / settings.expectedVoters) * 100))}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/[0.08]">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (voteLogs.length / settings.expectedVoters) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>{Math.max(0, settings.expectedVoters - voteLogs.length)} remaining to vote</span>
                  <span>{voteLogs.length} casted</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Roster Management */}
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.06] pb-4 mb-5 gap-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-heading font-bold text-white tracking-tight">Roster Management</h3>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-white/[0.08] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRosterMode('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  rosterMode === 'form'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Voter Form
              </button>
              <button
                type="button"
                onClick={() => setRosterMode('csv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  rosterMode === 'csv'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Upload CSV
              </button>
            </div>
          </div>

          {rosterMode === 'form' ? (
            <div>
              {!isMultiVoterMode ? (
                /* Single Voter Creation Form */
                <form onSubmit={handleCreateVoter} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      Student Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      className="glass-input !py-2.5 !text-xs font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-cyan-400" />
                        Enrollment No. / Roll No. <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={voterEnrollmentNo}
                        onChange={(e) => setVoterEnrollmentNo(e.target.value.toUpperCase())}
                        placeholder="e.g. 21BCS001 or Roll 14"
                        className="glass-input !py-2.5 !text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        College Email <span className="text-slate-500 font-sans text-[10px] lowercase">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={voterEmail}
                        onChange={(e) => setVoterEmail(e.target.value)}
                        placeholder="Optional (e.g. alice@school.edu)"
                        className="glass-input !py-2.5 !text-xs font-sans"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/15 flex items-start gap-2.5 text-xs text-slate-300">
                    <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      <strong className="text-slate-200">Rule:</strong> Voter needs only their <strong className="text-cyan-300">Full Name</strong> and <strong className="text-cyan-300">Enrollment No. / Roll No.</strong> to authenticate and vote. College Email is completely optional.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingRoster}
                      className="btn-primary w-full sm:flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-2"
                    >
                      {isSubmittingRoster ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Registering Voter...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Register Eligible Voter
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMultiVoterMode(true)}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-medium border border-white/[0.08] transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400" />
                      Add Multiple
                    </button>
                  </div>
                </form>
              ) : (
                /* Multi-Voter Grid Form */
                <form onSubmit={handleCreateVoter} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                      Batch Entry ({1 + extraVoterRows.length} {1 + extraVoterRows.length === 1 ? 'Voter' : 'Voters'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMultiVoterMode(false)}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Switch to Single Form
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {/* Primary Row 1 */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>#1 Primary Entry</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={voterName}
                          onChange={(e) => setVoterName(e.target.value)}
                          placeholder="Full Name *"
                          className="glass-input !py-1.5 !px-2.5 !text-xs font-sans"
                        />
                        <input
                          type="text"
                          required
                          value={voterEnrollmentNo}
                          onChange={(e) => setVoterEnrollmentNo(e.target.value.toUpperCase())}
                          placeholder="Enrollment / Roll No *"
                          className="glass-input !py-1.5 !px-2.5 !text-xs font-mono"
                        />
                        <input
                          type="email"
                          value={voterEmail}
                          onChange={(e) => setVoterEmail(e.target.value)}
                          placeholder="Email (Optional)"
                          className="glass-input !py-1.5 !px-2.5 !text-xs font-sans"
                        />
                      </div>
                    </div>

                    {/* Extra Rows */}
                    {extraVoterRows.map((row, idx) => (
                      <div key={row.id} className="bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span>#{idx + 2} Additional Voter</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraRow(idx)}
                            className="text-red-400 hover:text-red-300 p-0.5"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            value={row.name}
                            onChange={(e) => handleUpdateExtraRow(idx, 'name', e.target.value)}
                            placeholder="Full Name *"
                            className="glass-input !py-1.5 !px-2.5 !text-xs font-sans"
                          />
                          <input
                            type="text"
                            required
                            value={row.enrollmentNo}
                            onChange={(e) => handleUpdateExtraRow(idx, 'enrollmentNo', e.target.value.toUpperCase())}
                            placeholder="Enrollment / Roll No *"
                            className="glass-input !py-1.5 !px-2.5 !text-xs font-mono"
                          />
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => handleUpdateExtraRow(idx, 'email', e.target.value)}
                            placeholder="Email (Optional)"
                            className="glass-input !py-1.5 !px-2.5 !text-xs font-sans"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddVoterRow}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-medium border border-white/[0.08] transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400" />
                      Add Row
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRoster}
                      className="btn-primary flex-1 py-2 text-xs inline-flex items-center justify-center gap-2"
                    >
                      {isSubmittingRoster ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Saving Voters...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Register All {1 + extraVoterRows.length} Voters
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* CSV Upload Mode */
            <form onSubmit={handleUploadRosterCsv} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Select CSV Roster File
                </label>
                <input
                  type="file"
                  id="roster-csv-file"
                  accept=".csv,text/csv"
                  onChange={(e) => setRosterFile(e.target.files[0])}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20 bg-slate-950/70 p-2 rounded-xl border border-white/[0.08]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/[0.06] text-xs space-y-1.5">
                <div className="text-[11px] font-mono text-cyan-300 font-semibold">CSV Column Requirements:</div>
                <p className="text-[11px] text-slate-400">
                  Headers must include <span className="text-white font-mono">Name</span> and <span className="text-white font-mono">Enrollment No</span> (or <span className="text-white font-mono">Roll No</span>). Email is completely optional.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Download Sample CSV Template
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!rosterFile || isSubmittingRoster}
                className="btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-2"
              >
                {isSubmittingRoster ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Importing CSV...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Upload & Sync CSV Roster
                  </>
                )}
              </button>
            </form>
          )}

          {/* Current Eligible List */}
          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Current Eligible Roster</h4>
                <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold tabular-nums">
                  {eligibleVoters.length} Verified
                </span>
              </div>
              {eligibleVoters.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportRoster}
                  className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                  title="Export roster to CSV"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              )}
            </div>

            {eligibleVoters.length > 0 && (
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search by name, roll no, enrollment no, or email..."
                className="w-full mb-2.5 px-3 py-1.5 bg-slate-950/70 text-xs text-slate-300 rounded-lg border border-white/[0.08] focus:outline-none focus:border-cyan-400/80 placeholder:text-slate-500 font-sans"
              />
            )}

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {eligibleVoters.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2 text-center">No voters registered on roster yet. Use the form above to add eligible voters.</p>
              ) : (
                eligibleVoters
                  .filter(v => {
                    if (!rosterSearch) return true;
                    const q = rosterSearch.toLowerCase();
                    return (
                      v.name?.toLowerCase().includes(q) ||
                      v.email?.toLowerCase().includes(q) ||
                      v.enrollmentNo?.toLowerCase().includes(q)
                    );
                  })
                  .map(v => (
                    <div key={v._id} className="flex justify-between items-center bg-slate-950/50 hover:bg-slate-950/80 px-3 py-2 rounded-lg border border-white/[0.05] transition-colors">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-200 font-medium">{v.name}</span>
                          {v.enrollmentNo && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                              {v.enrollmentNo}
                            </span>
                          )}
                        </div>
                        {v.email && <span className="text-[11px] font-mono text-slate-400">{v.email}</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteVoter(v._id)} 
                        className="text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors hover:bg-red-500/10" 
                        title="Remove voter from roster"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Creation Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Add Position */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-heading font-bold text-white mb-4 tracking-tight">Create Position</h3>
          <form onSubmit={handleAddPosition} className="space-y-3">
            <input 
              type="text" 
              required 
              value={posName}
              onChange={(e) => setPosName(e.target.value)}
              placeholder="e.g. Class President"
              className="glass-input"
            />
            <button type="submit" className="btn-primary w-full py-2.5 text-sm">
              Add Position
            </button>
          </form>
        </div>

        {/* Add Candidate */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Register Candidate</h3>
          </div>
          <form onSubmit={handleAddCandidate} className="space-y-3">
            <select 
              required
              value={candPos}
              onChange={(e) => setCandPos(e.target.value)}
              className="glass-input"
            >
              <option value="">-- Select Target Position --</option>
              {positions.map(p => (
                <option key={p._id} value={p._id} className="bg-slate-900 text-white">{p.name}</option>
              ))}
            </select>
            <input 
              type="text" 
              required 
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
              placeholder="Candidate Full Name"
              className="glass-input"
            />
            <div className="space-y-2">
              <input 
                type="url" 
                value={candPhoto}
                onChange={(e) => { setCandPhoto(e.target.value); setCandPhotoFile(null); if (document.getElementById('cand-photo-file')) document.getElementById('cand-photo-file').value = ''; }}
                placeholder="Photo URL (e.g. https://...)"
                className="glass-input !text-xs"
              />
              <div className="flex items-center gap-2">
                <div className="h-px bg-white/[0.06] flex-1"></div>
                <span className="text-slate-500 text-[11px] font-mono">OR LOCAL IMAGE</span>
                <div className="h-px bg-white/[0.06] flex-1"></div>
              </div>
              <input
                type="file"
                id="cand-photo-file"
                accept="image/*"
                onChange={(e) => { setCandPhotoFile(e.target.files[0]); setCandPhoto(''); }}
                className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 text-sm">
              Save Candidate
            </button>
          </form>
        </div>
      </div>

      {/* Live Admin Monitor */}
      <div className="glass-panel p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Live Plurality Monitor</h3>
            <p className="text-xs text-slate-400">Current vote tallies per position and candidate.</p>
          </div>
          <button 
            onClick={loadDashboardData} 
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 rounded-lg border border-white/[0.08] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {adminResults.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No offices defined.</p>
          ) : (
            adminResults.map(pos => (
              <div key={pos.positionId} className="bg-slate-950/60 rounded-xl border border-white/[0.06] overflow-hidden flex flex-col">
                <div className="bg-slate-900/80 px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
                  <div>
                    <h4 className="font-heading font-bold text-cyan-300 text-base">{pos.name}</h4>
                    <div className="text-xs font-mono text-slate-400 tabular-nums">
                      Total Ballots Cast: <span className="text-white font-bold">{pos.totalVotes}</span>
                      {settings.expectedVoters > 0 && (
                        <span className="text-cyan-300 ml-1.5 font-semibold">
                          / {settings.expectedVoters} ({Math.round((pos.totalVotes / settings.expectedVoters) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeletePosition(pos.positionId)} 
                    className="text-red-400 hover:text-red-300 p-1.5 rounded-lg transition-colors hover:bg-red-500/10" 
                    title="Delete Position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                  {pos.candidates.sort((a,b) => b.votes - a.votes).map(c => {
                    const percent = pos.totalVotes > 0 ? Math.round((c.votes / pos.totalVotes) * 100) : 0;

                    return (
                      <div key={c.candidateId} className="flex flex-col items-center bg-slate-900/40 rounded-xl p-3 relative border border-white/[0.05] hover:border-cyan-500/30 transition-all group">
                        <button 
                          onClick={() => handleDeleteCandidate(c.candidateId)} 
                          className="absolute top-1.5 right-1.5 text-red-400 hover:text-red-300 p-1 bg-slate-950/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                          title="Delete Candidate"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <img 
                          src={c.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0d172e&color=22d3ee`} 
                          className="w-14 h-14 rounded-full object-cover mb-2 border border-white/[0.1]" 
                          alt={c.name} 
                        />
                        <span className="text-slate-200 text-xs font-medium text-center line-clamp-2 min-h-[2rem] flex items-center font-heading">
                          {c.name}
                        </span>
                        <span className="font-mono font-bold text-white text-xs mt-1.5 bg-slate-950 px-2.5 py-0.5 rounded-full border border-white/[0.08] tabular-nums">
                          {c.votes} votes {pos.totalVotes > 0 ? `(${percent}%)` : ''}
                        </span>

                        {pos.totalVotes > 0 && (
                          <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-white/[0.06]">
                            <div 
                              className="bg-cyan-400 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Voter Turnout & Attendance (Anonymous Secret Ballot) */}
      <div className="glass-panel p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-heading font-bold text-white tracking-tight">Voter Turnout & Attendance</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold uppercase inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Anonymous Secret Ballot
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Verified attendance log of voters who participated. Candidate choices are strictly decoupled and confidential.</p>
          </div>
          <button 
            onClick={handleDownloadCSV} 
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 rounded-lg border border-white/[0.08] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Turnout CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="font-mono uppercase text-slate-400 bg-slate-950/60 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-2.5">Voter Name</th>
                <th className="px-4 py-2.5">En No.</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Voting Channel</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {voteLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-500 italic">No voters have participated yet in current election session.</td>
                </tr>
              ) : (
                voteLogs.map(log => (
                  <tr key={log._id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-medium text-white">{log.voterName}</td>
                    <td className="px-4 py-2.5 font-mono text-cyan-300 font-semibold">{log.voterEnrollmentNo || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{log.voterEmail}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        log.channel === 'manual_kiosk' 
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : log.channel === 'offline_sync'
                          ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      }`}>
                        {log.channel === 'manual_kiosk' ? 'In-Person Kiosk' : log.channel === 'offline_sync' ? 'Offline Synced' : 'Online Portal'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{new Date(log.votedAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ballot Cast
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="glass-panel p-6 sm:p-8 border-red-500/30 bg-red-950/10">
        <div className="mb-4">
          <h3 className="text-lg font-heading font-bold text-red-400 tracking-tight">Administrative Danger Zone</h3>
          <p className="text-xs text-slate-400">Irreversible actions that affect live election data.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 rounded-xl border border-red-900/40 p-4">
            <h4 className="font-heading font-bold text-slate-200 text-sm mb-1">Reset All Cast Ballots</h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">Deletes all voter submission records, resetting all tallies to zero. Candidate configurations and roster remain intact.</p>
            <button 
              onClick={async () => {
                if (window.confirm("Are you ABSOLUTELY sure you want to delete all casted votes? This cannot be undone.")) {
                  try {
                    const res = await fetch('/api/admin/votes', { method: 'DELETE' });
                    if (res.ok) {
                      showMessage('All votes have been reset.', false);
                      loadDashboardData();
                    }
                  } catch (e) {
                    showMessage('Failed to reset votes.', true);
                  }
                }
              }}
              className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-mono font-medium rounded-lg border border-red-800/60 transition-colors w-full"
            >
              Purge Cast Ballots
            </button>
          </div>

          <div className="bg-slate-950/60 rounded-xl border border-red-900/40 p-4">
            <h4 className="font-heading font-bold text-slate-200 text-sm mb-1">Wipe Entire Election State</h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">Completely purges all positions, registered candidates, and voter records to initialize a clean election.</p>
            <button 
              onClick={async () => {
                if (window.confirm("Are you ABSOLUTELY sure you want to wipe the entire election? ALL candidates, positions, and votes will be permanently deleted!")) {
                  try {
                    const res = await fetch('/api/admin/election', { method: 'DELETE' });
                    if (res.ok) {
                      showMessage('The entire election has been wiped.', false);
                      loadDashboardData();
                    }
                  } catch (e) {
                    showMessage('Failed to wipe election.', true);
                  }
                }
              }}
              className="px-3 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-200 text-xs font-mono font-bold rounded-lg border border-red-700 transition-colors w-full"
            >
              Wipe Election
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
