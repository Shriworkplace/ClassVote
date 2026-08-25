import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import Alert from '../components/Alert';
import { motion } from 'framer-motion';
import { Lock, LogOut, Settings, Users, UserPlus, Clock, Trash2, Download, ShieldCheck, QrCode, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

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
  
  // Forms state
  const [rosterData, setRosterData] = useState('');
  const [rosterFile, setRosterFile] = useState(null);
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

  const handleUpdateRoster = async () => {
    try {
      let res;
      
      if (rosterFile) {
        const formData = new FormData();
        formData.append('file', rosterFile);
        
        res = await fetch('/api/admin/upload-roster', {
          method: 'POST',
          body: formData
        });
      } else {
        const voters = JSON.parse(rosterData);
        res = await fetch('/api/admin/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voters })
        });
      }
      
      if (res.ok) {
        const data = await res.json();
        showMessage(`Roster synced with ${data.count} voters`);
        setRosterData('');
        setRosterFile(null);
        if (document.getElementById('roster-file')) {
          document.getElementById('roster-file').value = '';
        }
        loadDashboardData();
      } else {
        const errData = await res.json();
        showMessage(errData.error || 'Failed to update roster', true);
      }
    } catch (e) {
      showMessage('Invalid JSON format or file upload error', true);
    }
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

  const handleDownloadCSV = () => {
    if (voteLogs.length === 0) {
      showMessage('No votes to download.', true);
      return;
    }
    const headers = ['Voter Name', 'Voter Email', 'Position', 'Candidate', 'Timestamp'];
    const rows = voteLogs.map(log => [
      `"${log.voterName}"`,
      `"${log.voterEmail}"`,
      `"${log.positionName}"`,
      `"${log.candidateName}"`,
      `"${new Date(log.votedAt).toLocaleString()}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "vote_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteVote = async (id) => {
    if (window.confirm("Are you sure you want to delete this specific vote record?")) {
      try {
        const res = await fetch(`/api/admin/votes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Vote record deleted');
          loadDashboardData();
        } else {
          showMessage('Failed to delete vote', true);
        }
      } catch (e) {
        showMessage('Error deleting vote', true);
      }
    }
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
        
        <button 
          onClick={handleLogout} 
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-mono font-medium transition-colors border border-white/[0.08]"
        >
          <LogOut className="w-3.5 h-3.5" /> Terminate Session
        </button>
      </div>

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
        </div>

        {/* Roster Management */}
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4 mb-4">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Roster Management</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Upload a .csv with "Name" and "Email" columns or paste JSON voter list.</p>
          
          <input 
            type="file" 
            id="roster-file"
            accept=".csv,text/csv"
            onChange={(e) => setRosterFile(e.target.files[0])}
            className="w-full mb-3 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20"
          />
          
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px bg-white/[0.06] flex-1"></div>
            <span className="text-slate-500 text-xs font-mono">OR RAW JSON</span>
            <div className="h-px bg-white/[0.06] flex-1"></div>
          </div>
          
          <textarea 
            value={rosterData}
            onChange={(e) => setRosterData(e.target.value)}
            disabled={!!rosterFile}
            className={`w-full h-32 bg-slate-950/70 text-slate-300 p-3 rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 font-mono text-xs resize-none mb-3 ${rosterFile ? 'opacity-40 cursor-not-allowed' : ''}`}
            placeholder={`[\n  {\n    "name": "Alice Smith",\n    "email": "alice@school.edu"\n  }\n]`}
          />
          <button onClick={handleUpdateRoster} className="btn-primary w-full py-2.5 text-sm">
            Sync Eligible Roster
          </button>

          {/* Current Eligible List */}
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Current Eligible Roster</h4>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold tabular-nums">
                {eligibleVoters.length} Verified
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {eligibleVoters.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No voters registered on roster yet.</p>
              ) : (
                eligibleVoters.map(v => (
                  <div key={v._id} className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded-lg border border-white/[0.05]">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-200 font-medium">{v.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">{v.email}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteVoter(v._id)} 
                      className="text-red-400 hover:text-red-300 p-1 transition-colors" 
                      title="Remove voter"
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
                    <div className="text-xs font-mono text-slate-400 tabular-nums">Total Ballots Cast: {pos.totalVotes}</div>
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
                  {pos.candidates.sort((a,b) => b.votes - a.votes).map(c => (
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
                        {c.votes} votes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Vote Audit Logs */}
      <div className="glass-panel p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Vote Audit Logs</h3>
            <p className="text-xs text-slate-400">Timestamped record of individual ballot submissions.</p>
          </div>
          <button 
            onClick={handleDownloadCSV} 
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 rounded-lg border border-white/[0.08] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="font-mono uppercase text-slate-400 bg-slate-950/60 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-2.5">Voter Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Position</th>
                <th className="px-4 py-2.5">Candidate Choice</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {voteLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-500 italic">No votes cast yet in current session.</td>
                </tr>
              ) : (
                voteLogs.map(log => (
                  <tr key={log._id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-medium text-white">{log.voterName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{log.voterEmail}</td>
                    <td className="px-4 py-2.5 text-slate-300">{log.positionName}</td>
                    <td className="px-4 py-2.5 text-cyan-300 font-medium">{log.candidateName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{new Date(log.votedAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button 
                        onClick={() => handleDeleteVote(log._id)} 
                        className="text-red-400 hover:text-red-300 p-1 rounded transition-colors" 
                        title="Delete Vote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
