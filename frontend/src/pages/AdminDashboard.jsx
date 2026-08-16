import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import Alert from '../components/Alert';
import { motion } from 'framer-motion';
import { Lock, LogOut, Settings, Users, UserPlus, Clock, Trash2, Download } from 'lucide-react';
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
      // Re-fetch dashboard data (specifically adminResults) when someone votes
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
        setError('Invalid admin password');
      }
    } catch (err) {
      setError('Login failed');
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
        showMessage(`Schedule updated`);
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
        showMessage(`Updated roster with ${data.count} voters`);
        setRosterData('');
        setRosterFile(null);
        document.getElementById('roster-file').value = '';
        loadDashboardData();
      } else {
        const errData = await res.json();
        showMessage(errData.error || 'Failed to update roster', true);
      }
    } catch (e) {
      showMessage('Invalid JSON format or File upload error', true);
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
          showMessage('Failed to upload photo', true);
          return;
        }
      }

      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: candPos, name: candName, photoUrl: finalPhotoUrl })
      });
      if (res.ok) {
        showMessage('Candidate added');
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
    if (window.confirm("Are you sure you want to delete this specific vote?")) {
      try {
        const res = await fetch(`/api/admin/votes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Vote deleted successfully');
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
    if (window.confirm("Are you sure you want to delete this position and all its candidates?")) {
      try {
        const res = await fetch(`/api/admin/positions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Position deleted successfully');
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
    if (window.confirm("Are you sure you want to delete this candidate?")) {
      try {
        const res = await fetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showMessage('Candidate deleted successfully');
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
          showMessage('Voter removed successfully');
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
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="glass-panel w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold mb-6">Admin Access</h2>
          <Alert message={error} type="error" />
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master Password"
              required
              className="glass-input mb-4"
            />
            <button type="submit" className="btn-primary w-full">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">Control Panel</h2>
          <p className="text-slate-400">Manage elections, voters, and candidates</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="fixed top-24 right-6 z-50 w-80">
        <Alert message={error} type="error" />
        <Alert message={success} type="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Election Settings */}
        <div className="glass-panel p-6 space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-4">
            <Settings className="w-6 h-6 text-cyan-500" />
            <h3 className="text-xl font-bold">Election Status</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-center">
              <div className="text-sm text-slate-400 mb-2">Voting Portal</div>
              <div className={`text-xl font-bold ${settings.votingOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {settings.votingOpen ? 'OPEN' : 'CLOSED'}
              </div>
              <button onClick={() => toggleSetting('votingOpen')} className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-slate-600">
                Toggle Manual
              </button>
            </div>
            
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-center">
              <div className="text-sm text-slate-400 mb-2">Public Results</div>
              <div className={`text-xl font-bold ${settings.resultsPublished ? 'text-emerald-400' : 'text-slate-500'}`}>
                {settings.resultsPublished ? 'PUBLISHED' : 'HIDDEN'}
              </div>
              <button onClick={() => toggleSetting('resultsPublished')} className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-slate-600">
                Toggle Visibility
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-4 flex items-center justify-between">
            <div className="pr-4">
               <div className="text-sm text-slate-400 mb-1">Share Voting Portal</div>
               <div className="text-sm font-mono text-cyan-400 break-all">{window.location.origin}</div>
               <p className="text-xs text-slate-500 mt-2">Display this QR code on a projector or screen so students can scan it and vote instantly.</p>
            </div>
            <div className="bg-white p-2 rounded-lg flex-shrink-0">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin)}`} 
                 alt="QR Code" 
                 className="w-24 h-24"
               />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-2 mb-4">
               <Clock className="w-5 h-5 text-cyan-500" />
               <h4 className="font-semibold text-lg">Schedule Window (Overrides Manual)</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Time</label>
                  <DatePicker 
                    selected={startTime} 
                    onChange={(date) => setStartTime(date)} 
                    showTimeSelect 
                    dateFormat="Pp"
                    className="glass-input !py-2 !text-sm"
                    placeholderText="Immediate"
                  />
               </div>
               <div>
                  <label className="block text-sm text-slate-400 mb-1">Close Time</label>
                  <DatePicker 
                    selected={closeTime} 
                    onChange={(date) => setCloseTime(date)} 
                    showTimeSelect 
                    dateFormat="Pp"
                    className="glass-input !py-2 !text-sm"
                    placeholderText="Manual Close"
                  />
               </div>
            </div>
            <button onClick={updateSchedule} className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors border border-slate-600 text-sm">
               Save Schedule
            </button>
          </div>
        </div>

        {/* Roster Management */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-4">
            <Users className="w-6 h-6 text-cyan-500" />
            <h3 className="text-xl font-bold">Roster Management</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">Provide a JSON array OR upload a .csv file (must have "Name" and "Email" columns).</p>
          <input 
            type="file" 
            id="roster-file"
            accept=".csv,text/csv"
            onChange={(e) => setRosterFile(e.target.files[0])}
            className="w-full mb-4 text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-500 hover:file:bg-cyan-500/20"
          />
          <div className="flex items-center gap-2 mb-4">
             <div className="h-px bg-slate-700 flex-1"></div>
             <span className="text-slate-500 text-sm">OR</span>
             <div className="h-px bg-slate-700 flex-1"></div>
          </div>
          <textarea 
            value={rosterData}
            onChange={(e) => setRosterData(e.target.value)}
            disabled={!!rosterFile}
            className={`w-full h-40 bg-slate-900/60 text-slate-300 p-4 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 font-mono text-sm resize-none mb-4 ${rosterFile ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder={`[\n  {\n    "name": "Alice Smith",\n    "email": "alice@school.edu"\n  }\n]`}
          />
          <button onClick={handleUpdateRoster} className="btn-primary w-full">Sync Roster</button>

          {/* Eligible Voters List */}
          <div className="mt-6 pt-6 border-t border-slate-700">
             <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg">Current Eligible Voters</h4>
                <span className="text-sm font-mono text-cyan-400 bg-slate-800 px-2 py-1 rounded">{eligibleVoters.length} Total</span>
             </div>
             <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                 {eligibleVoters.length === 0 ? (
                    <p className="text-sm text-slate-500">No voters currently eligible.</p>
                 ) : (
                    eligibleVoters.map(v => (
                       <div key={v._id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700">
                          <div className="flex flex-col">
                             <span className="text-sm text-slate-300 font-medium">{v.name}</span>
                             <span className="text-xs text-slate-500">{v.email}</span>
                          </div>
                          <button onClick={() => handleDeleteVoter(v._id)} className="text-red-400 hover:text-red-300 p-1 rounded transition-colors" title="Delete Voter">
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    ))
                 )}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
         {/* Add Position */}
         <div className="glass-panel p-6">
            <h3 className="text-xl font-bold mb-4">Add Position</h3>
            <form onSubmit={handleAddPosition} className="space-y-4">
               <input 
                  type="text" 
                  required 
                  value={posName}
                  onChange={(e) => setPosName(e.target.value)}
                  placeholder="e.g. Class President"
                  className="glass-input"
               />
               <button type="submit" className="btn-primary w-full">Create Position</button>
            </form>
         </div>

         {/* Add Candidate */}
         <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-4">
               <UserPlus className="w-6 h-6 text-cyan-500" />
               <h3 className="text-xl font-bold">Add Candidate</h3>
            </div>
            <form onSubmit={handleAddCandidate} className="space-y-4">
               <select 
                  required
                  value={candPos}
                  onChange={(e) => setCandPos(e.target.value)}
                  className="glass-input appearance-none"
               >
                  <option value="">-- Select Position --</option>
                  {positions.map(p => (
                     <option key={p._id} value={p._id} className="bg-slate-800">{p.name}</option>
                  ))}
               </select>
               <input 
                  type="text" 
                  required 
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  placeholder="Candidate Name"
                  className="glass-input"
               />
               <div className="flex flex-col gap-2">
                 <input 
                    type="url" 
                    value={candPhoto}
                    onChange={(e) => { setCandPhoto(e.target.value); setCandPhotoFile(null); if (document.getElementById('cand-photo-file')) document.getElementById('cand-photo-file').value = ''; }}
                    placeholder="Photo URL (e.g. https://example.com/photo.jpg)"
                    className="glass-input"
                 />
                 <div className="flex items-center gap-2">
                   <div className="h-px bg-slate-700 flex-1"></div>
                   <span className="text-slate-500 text-sm">OR UPLOAD</span>
                   <div className="h-px bg-slate-700 flex-1"></div>
                 </div>
                 <input
                    type="file"
                    id="cand-photo-file"
                    accept="image/*"
                    onChange={(e) => { setCandPhotoFile(e.target.files[0]); setCandPhoto(''); }}
                    className="w-full text-sm text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-500 hover:file:bg-cyan-500/20"
                 />
               </div>
               <button type="submit" className="btn-primary w-full">Register Candidate</button>
            </form>
         </div>
      </div>

      {/* Live Monitor */}
      <div className="glass-panel p-6">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Live Admin Monitor</h3>
            <button onClick={loadDashboardData} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded border border-slate-600 transition-colors">
               Refresh Data
            </button>
         </div>
         
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {adminResults.length === 0 ? (
               <p className="text-slate-500">No positions found.</p>
            ) : (
               adminResults.map(pos => (
                  <div key={pos.positionId} className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                     <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                        <div>
                           <h4 className="font-bold text-cyan-400">{pos.name}</h4>
                           <div className="text-xs text-slate-400">Total Cast: {pos.totalVotes}</div>
                        </div>
                        <button onClick={() => handleDeletePosition(pos.positionId)} className="text-red-400 hover:text-red-300 p-1 rounded transition-colors" title="Delete Position">
                           <Trash2 className="w-5 h-5" />
                        </button>
                     </div>
                     <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
                        {pos.candidates.sort((a,b) => b.votes - a.votes).map(c => (
                           <div key={c.candidateId} className="flex flex-col items-center bg-slate-800/50 rounded-xl p-3 relative border border-slate-700/50 hover:border-cyan-500/30 transition-colors group">
                              <button onClick={() => handleDeleteCandidate(c.candidateId)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 p-1.5 bg-slate-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Candidate">
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <img src={c.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1e293b&color=06b6d4`} className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-slate-700" alt={c.name} />
                              <span className="text-slate-200 text-sm font-medium text-center leading-tight line-clamp-2 min-h-[2.5rem] flex items-center">{c.name}</span>
                              <span className="font-bold text-white text-lg mt-2 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700/50">{c.votes} votes</span>
                           </div>
                        ))}
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>

      {/* Vote Logs */}
      <div className="glass-panel p-6 mt-8">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Vote Logs</h3>
            <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded border border-slate-600 transition-colors">
               <Download className="w-4 h-4" /> Download CSV
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
               <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                  <tr>
                     <th className="px-4 py-3">Voter Name</th>
                     <th className="px-4 py-3">Email</th>
                     <th className="px-4 py-3">Position</th>
                     <th className="px-4 py-3">Candidate</th>
                     <th className="px-4 py-3">Time</th>
                     <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {voteLogs.length === 0 ? (
                     <tr>
                        <td colSpan="6" className="px-4 py-4 text-center text-slate-500">No votes recorded yet.</td>
                     </tr>
                  ) : (
                     voteLogs.map(log => (
                        <tr key={log._id} className="border-b border-slate-800 hover:bg-slate-800/30">
                           <td className="px-4 py-3">{log.voterName}</td>
                           <td className="px-4 py-3">{log.voterEmail}</td>
                           <td className="px-4 py-3">{log.positionName}</td>
                           <td className="px-4 py-3">{log.candidateName}</td>
                           <td className="px-4 py-3">{new Date(log.votedAt).toLocaleString()}</td>
                           <td className="px-4 py-3 text-right">
                              <button onClick={() => handleDeleteVote(log._id)} className="text-red-400 hover:text-red-300 p-1 rounded transition-colors" title="Delete Vote">
                                 <Trash2 className="w-4 h-4" />
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
      <div className="glass-panel p-6 mt-8 border-red-500/30 bg-red-950/10">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-red-400">Danger Zone</h3>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 rounded-xl border border-red-900/50 p-4">
               <h4 className="font-bold text-slate-200 mb-2">Reset Casted Votes</h4>
               <p className="text-sm text-slate-400 mb-4">This will delete all votes currently cast by students, resetting the tallies to 0. Candidates, positions, and eligible roster will remain intact.</p>
               <button 
                  onClick={async () => {
                     if (window.confirm("Are you ABSOLUTELY sure you want to delete all casted votes? This cannot be undone.")) {
                        try {
                           const res = await fetch('/api/admin/votes', { method: 'DELETE' });
                           if (res.ok) {
                              showMessage('All votes have been successfully reset.', false);
                              loadDashboardData();
                           }
                        } catch (e) {
                           showMessage('Failed to reset votes.', true);
                        }
                     }
                  }}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-800 text-red-200 text-sm rounded border border-red-800 transition-colors w-full"
               >
                  Delete All Votes
               </button>
            </div>

            <div className="bg-slate-900/50 rounded-xl border border-red-900/50 p-4">
               <h4 className="font-bold text-slate-200 mb-2">Wipe Entire Election</h4>
               <p className="text-sm text-slate-400 mb-4">This will completely wipe EVERYTHING: Votes, Candidates, and Positions. Use this to start a brand new election from scratch.</p>
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
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-800 text-red-200 text-sm rounded border border-red-800 transition-colors w-full font-bold"
               >
                  Wipe Election Session
               </button>
            </div>
         </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
