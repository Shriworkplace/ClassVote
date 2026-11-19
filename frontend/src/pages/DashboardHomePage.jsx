import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Vote, Users, BarChart3, Monitor, Copy, Check, Trash2,
  Settings, ExternalLink, QrCode, X, Loader2, ShieldCheck, Globe, Lock, Sparkles,
  Shield, Smartphone
} from 'lucide-react';
import Alert from '../components/Alert';
import TwoFactorSettingsModal from '../components/TwoFactorSettingsModal';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../utils/usePageMeta';

const ACCESS_MODE_LABELS = {
  roster: { label: 'Roster Verified', icon: ShieldCheck, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' },
  open: { label: 'Open Link', icon: Globe, color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25' },
  kiosk_only: { label: 'Kiosk Only', icon: Monitor, color: 'text-amber-300 bg-amber-500/10 border-amber-500/25' }
};

const DashboardHomePage = () => {
  const { user, updateProfile, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [is2FAOpen, setIs2FAOpen] = useState(false);

  usePageMeta({
    title: 'Organizer Elections Hub',
    description: 'Manage your verified elections, candidate rosters, and results.',
    robots: 'noindex, nofollow'
  });

  const [elections, setElections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [copiedSlug, setCopiedSlug] = useState('');

  // Create Election Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [accessMode, setAccessMode] = useState('roster');
  const [expectedVoters, setExpectedVoters] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // QR Modal state
  const [qrElection, setQrElection] = useState(null);

  // Profile Modal state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileOrg, setProfileOrg] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const showToast = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage({ text: '', isError: false }), 4000);
  };

  const fetchElections = useCallback(async () => {
    try {
      const res = await fetch('/api/elections');
      if (res.ok) {
        setElections(await res.json());
      } else {
        showToast('Failed to load your elections.', true);
      }
    } catch {
      showToast('Network error while loading elections.', true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  const openCreateModal = () => {
    setTitle('');
    setOrganization(user?.organization || '');
    setDescription('');
    setSlug('');
    setAccessMode('roster');
    setExpectedVoters('');
    setIsCreateOpen(true);
  };

  const handleCreateElection = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          organization: organization.trim(),
          description: description.trim(),
          slug: slug.trim() || undefined,
          accessMode,
          expectedVoters: Number(expectedVoters) || 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCreateOpen(false);
        navigate(`/dashboard/elections/${data._id}`);
      } else {
        showToast(data.error || 'Could not create election.', true);
      }
    } catch {
      showToast('Server error while creating election.', true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteElection = async (el) => {
    if (!window.confirm(`Permanently delete "${el.title}" and all its positions, candidates, and ballots?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/elections/${el._id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted "${el.title}".`);
        fetchElections();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete election.', true);
      }
    } catch {
      showToast('Error deleting election.', true);
    }
  };

  const handleCopyLink = (elSlug) => {
    const url = `${window.location.origin}/e/${elSlug}`;
    navigator.clipboard?.writeText(url);
    setCopiedSlug(elSlug);
    setTimeout(() => setCopiedSlug(''), 2000);
  };

  const openProfileModal = () => {
    setProfileName(user?.name || '');
    setProfileOrg(user?.organization || '');
    setCurrentPassword('');
    setNewPassword('');
    setIsProfileOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const payload = { name: profileName.trim(), organization: profileOrg.trim() };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      await updateProfile(payload);
      setIsProfileOpen(false);
      showToast('Account settings updated.');
    } catch (err) {
      showToast(err.message || 'Failed to update account.', true);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const totalVotesAll = elections.reduce((sum, el) => sum + (el.stats?.votersCount || 0), 0);
  const activeCount = elections.filter((el) => el.isCurrentlyOpen).length;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-16 space-y-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="badge-kicker">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Organizer Workspace</span>
            </span>
            {user?.organization && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-white/[0.08]">
                {user.organization}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight">
            Welcome, {user?.name}
          </h1>
          <p className="text-sm text-slate-400">
            Create elections, upload rosters, launch in-person kiosks, and monitor real-time standings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIs2FAOpen(true)}
            className={`px-3 py-2 text-xs rounded-xl border inline-flex items-center gap-1.5 transition-all ${
              user?.twoFactorEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-900/60 border-white/[0.08] text-slate-400 hover:text-slate-200'
            }`}
            title="Two-Factor Authentication Security"
          >
            <Shield className={`w-3.5 h-3.5 ${user?.twoFactorEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>2FA: {user?.twoFactorEnabled ? 'Active' : 'Off'}</span>
          </button>
          <button
            type="button"
            onClick={openProfileModal}
            className="btn-secondary px-4 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2"
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span>Account</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 shadow-[0_0_24px_rgba(6,182,212,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>New Election</span>
          </button>
        </div>
      </div>

      {message.text && <Alert message={message.text} type={message.isError ? 'error' : 'success'} />}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Your Elections</div>
            <div className="text-3xl font-heading font-black text-white mt-1 tabular-nums">{elections.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Vote className="w-6 h-6" />
          </div>
        </div>
        <div className="glass-panel p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Active Polls</div>
            <div className="text-3xl font-heading font-black text-emerald-400 mt-1 tabular-nums">{activeCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
        <div className="glass-panel p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Ballots Cast</div>
            <div className="text-3xl font-heading font-black text-white mt-1 tabular-nums">{totalVotesAll}</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Elections Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-mono text-slate-400">Loading your elections...</span>
        </div>
      ) : elections.length === 0 ? (
        <div className="glass-panel p-12 text-center space-y-5 border border-dashed border-cyan-500/30">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <Vote className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-heading font-bold text-white">No elections created yet</h2>
            <p className="text-sm text-slate-400">
              Create your first election to get a dedicated shareable link, QR code, live tallies, and an in-person Kiosk booth.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Election</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((el) => {
            const modeMeta = ACCESS_MODE_LABELS[el.accessMode] || ACCESS_MODE_LABELS.roster;
            const ModeIcon = modeMeta.icon;
            return (
              <motion.div
                key={el._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 flex flex-col justify-between gap-5 hover:border-cyan-500/35 transition-all"
              >
                <div className="space-y-3">
                  {/* Status Pills */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                      el.isCurrentlyOpen
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 border-white/[0.08]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${el.isCurrentlyOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {el.isCurrentlyOpen ? 'Voting Live' : 'Closed'}
                    </span>

                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${modeMeta.color}`}>
                      <ModeIcon className="w-3 h-3" />
                      {modeMeta.label}
                    </span>
                  </div>

                  {/* Title & Org */}
                  <div>
                    <h3 className="text-lg font-heading font-extrabold text-white tracking-tight line-clamp-1">
                      {el.title}
                    </h3>
                    {el.organization && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{el.organization}</p>
                    )}
                  </div>

                  {/* Shareable Code Pill */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-white/[0.06] text-xs font-mono">
                    <span className="text-cyan-300 truncate">/e/{el.slug}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(el.slug)}
                        className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Copy Shareable Link"
                      >
                        {copiedSlug === el.slug ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrElection(el)}
                        className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Show QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mini Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-slate-950/50 rounded-lg py-2 px-1 border border-white/[0.05]">
                      <div className="text-sm font-mono font-bold text-white">{el.stats?.positionsCount || 0}</div>
                      <div className="text-[10px] text-slate-400">Offices</div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg py-2 px-1 border border-white/[0.05]">
                      <div className="text-sm font-mono font-bold text-white">{el.stats?.candidatesCount || 0}</div>
                      <div className="text-[10px] text-slate-400">Candidates</div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg py-2 px-1 border border-white/[0.05]">
                      <div className="text-sm font-mono font-bold text-cyan-300">{el.stats?.votersCount || 0}</div>
                      <div className="text-[10px] text-slate-400">Votes</div>
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                  <Link
                    to={`/dashboard/elections/${el._id}`}
                    className="btn-primary flex-1 py-2.5 text-xs text-center inline-flex items-center justify-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Manage</span>
                  </Link>
                  <Link
                    to={`/e/${el.slug}/kiosk`}
                    className="btn-secondary px-3 py-2.5 text-xs inline-flex items-center justify-center gap-1"
                    title="Launch In-Person Voting Booth"
                  >
                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  </Link>
                  <Link
                    to={`/e/${el.slug}/results`}
                    className="btn-secondary px-3 py-2.5 text-xs inline-flex items-center justify-center gap-1"
                    title="Public Results Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteElection(el)}
                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                    title="Delete Election"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CREATE ELECTION MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="glass-panel w-full max-w-lg p-6 sm:p-8 space-y-5 border border-white/[0.12] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-xl font-heading font-extrabold text-white">Create New Election</h2>
                  <p className="text-xs text-slate-400">Configure your election portal and voter access mode.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateElection} className="space-y-4">
                <div>
                  <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Election Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Student Council Committee Election 2026"
                    className="glass-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Organization / Class
                    </label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. B.Tech CSE Dept"
                      className="glass-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Custom Code <span className="text-slate-500 font-normal normal-case">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      placeholder="e.g. cs-2026"
                      className="glass-input font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Voter Access Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'roster', title: 'Roster Verified', desc: 'Strict CSV/list check', icon: ShieldCheck },
                      { id: 'open', title: 'Open Link', desc: 'Any email/ID (1 vote)', icon: Globe },
                      { id: 'kiosk_only', title: 'Kiosk Only', desc: 'In-person booth only', icon: Monitor }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = accessMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAccessMode(opt.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_16px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-950/60 border-white/[0.08] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                          <div className="text-xs font-heading font-bold">{opt.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Expected Voters <span className="text-slate-500 font-normal normal-case">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={expectedVoters}
                      onChange={(e) => setExpectedVoters(e.target.value)}
                      placeholder="e.g. 120"
                      className="glass-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Short Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional voter note"
                      className="glass-input"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="btn-secondary flex-1 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn-primary flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-2"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>{isCreating ? 'Creating...' : 'Create Election'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR SHARE MODAL */}
      <AnimatePresence>
        {qrElection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="glass-panel w-full max-w-sm p-6 text-center space-y-4 border border-white/[0.12]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-white text-base truncate">{qrElection.title}</h3>
                <button
                  type="button"
                  onClick={() => setQrElection(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${window.location.origin}/e/${qrElection.slug}`)}`}
                  alt="Election QR Code"
                  className="w-52 h-52"
                />
              </div>
              <div className="text-xs font-mono text-cyan-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-white/[0.08] break-all">
                {`${window.location.origin}/e/${qrElection.slug}`}
              </div>
              <button
                type="button"
                onClick={() => handleCopyLink(qrElection.slug)}
                className="btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-2"
              >
                {copiedSlug === qrElection.slug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSlug === qrElection.slug ? 'Link Copied!' : 'Copy Voter Link'}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACCOUNT SETTINGS MODAL */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md p-6 sm:p-8 space-y-5 border border-white/[0.12]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h3 className="text-lg font-heading font-bold text-white">Account Settings</h3>
                <button type="button" onClick={() => setIsProfileOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">Organization</label>
                  <input
                    type="text"
                    value={profileOrg}
                    onChange={(e) => setProfileOrg(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div className="pt-2 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Change Password (leave blank to keep current)</span>
                  </div>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="glass-input text-sm"
                  />
                  <input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="glass-input text-sm"
                  />
                </div>

                {/* Two-Factor Authentication Section */}
                <div className="pt-3 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Two-Factor Authentication</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      user?.twoFactorEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-white/[0.08]'
                    }`}>
                      {user?.twoFactorEnabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIs2FAOpen(true);
                    }}
                    className="btn-secondary w-full py-2 text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{user?.twoFactorEnabled ? 'Manage 2FA Settings & Backup Codes' : 'Configure 2FA Authenticator'}</span>
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsProfileOpen(false)} className="btn-secondary flex-1 py-2.5 text-xs">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingProfile} className="btn-primary flex-1 py-2.5 text-xs">
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2FA SETTINGS MODAL */}
      <TwoFactorSettingsModal
        isOpen={is2FAOpen}
        onClose={() => setIs2FAOpen(false)}
        user={user}
        onStatusChange={() => refreshUser()}
      />
    </div>
  );
};

export default DashboardHomePage;
