import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Alert from '../components/Alert';
import {
  LogIn, ArrowRight, ShieldCheck, Lock, Loader2, User, Mail,
  IdCard, Globe, Monitor, Hash, BarChart3
} from 'lucide-react';
import { usePageMeta } from '../utils/usePageMeta';

const EntryPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Code finder state (when visiting /entry without a slug)
  const [electionCodeInput, setElectionCodeInput] = useState('');

  // Scoped election metadata
  const [election, setElection] = useState(null);
  const [isLoadingElection, setIsLoadingElection] = useState(Boolean(slug));
  const [notFoundError, setNotFoundError] = useState('');

  // Voter auth form state
  const [name, setName] = useState('');
  const [authMethod, setAuthMethod] = useState('enrollment'); // 'enrollment' or 'email'
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  usePageMeta({
    title: election ? `Vote: ${election.title}` : (slug ? `Election ${slug}` : 'Join Election / Enter Code'),
    description: election
      ? `Official voter portal for ${election.title}${election.organization ? ` (${election.organization})` : ''}. Verify your eligibility and cast your secure ballot.`
      : 'Enter an election code or URL to vote in student council, club, or class elections.',
    robots: 'index, follow'
  });

  useEffect(() => {
    if (!slug) {
      setElection(null);
      setIsLoadingElection(false);
      return;
    }

    let cancelled = false;
    const loadElection = async () => {
      setIsLoadingElection(true);
      setNotFoundError('');
      try {
        const res = await fetch(`/api/e/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) {
            setElection(data);
            if (data.accessMode === 'open') {
              setAuthMethod('email');
            }
          } else {
            setNotFoundError(data.error || 'Election not found.');
          }
        }
      } catch {
        if (!cancelled) setNotFoundError('Could not connect to server.');
      } finally {
        if (!cancelled) setIsLoadingElection(false);
      }
    };

    loadElection();
    return () => { cancelled = true; };
  }, [slug]);

  const handleFindElection = (e) => {
    e.preventDefault();
    const cleaned = electionCodeInput
      .trim()
      .replace(/^https?:\/\/[^/]+\/e\//i, '')
      .replace(/^\/?e\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
    if (!cleaned) return;
    navigate(`/e/${encodeURIComponent(cleaned)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanName = name.trim();
    const cleanCredential = credential.trim();

    if (!cleanName) {
      setError('Full Name is required.');
      setIsLoading(false);
      return;
    }

    if (!cleanCredential) {
      setError(`Please enter your ${authMethod === 'enrollment' ? 'Enrollment / ID Number' : 'Email Address'}.`);
      setIsLoading(false);
      return;
    }

    const isEmailFormat = cleanCredential.includes('@');
    const payload = {
      name: cleanName,
      identifier: cleanCredential,
      ...(isEmailFormat ? { email: cleanCredential.toLowerCase() } : { enrollmentNo: cleanCredential.toUpperCase() })
    };

    const verifyUrl = slug ? `/api/e/${encodeURIComponent(slug)}/verify` : '/api/verify';

    try {
      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        const voterSession = {
          name: data.voter?.name || cleanName,
          email: data.voter?.email || (isEmailFormat ? cleanCredential.toLowerCase() : ''),
          enrollmentNo: data.voter?.enrollmentNo || (!isEmailFormat ? cleanCredential.toUpperCase() : '')
        };

        if (slug) {
          sessionStorage.setItem(`voter_${slug}`, JSON.stringify(voterSession));
          navigate(`/e/${encodeURIComponent(slug)}/voting`);
        } else {
          sessionStorage.setItem('voterName', voterSession.name);
          if (voterSession.email) sessionStorage.setItem('voterEmail', voterSession.email);
          if (voterSession.enrollmentNo) sessionStorage.setItem('voterEnrollmentNo', voterSession.enrollmentNo);
          navigate('/voting');
        }
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch {
      setError('An error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mode 1: No slug — Election Code Finder
  if (!slug) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="glass-panel w-full max-w-md p-8 sm:p-10 text-center space-y-6 relative overflow-hidden"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mx-auto flex items-center justify-center border border-cyan-500/30">
            <Hash className="w-7 h-7 text-cyan-400" />
          </div>
          <div className="space-y-2">
            <div className="badge-kicker">
              <span>Join an Election</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              Enter Election Code
            </h2>
            <p className="text-sm text-slate-300">
              Type the unique election code or paste the invite link shared by your organizer.
            </p>
          </div>

          <form onSubmit={handleFindElection} className="space-y-4">
            <input
              type="text"
              required
              value={electionCodeInput}
              onChange={(e) => setElectionCodeInput(e.target.value)}
              placeholder="e.g. cs-council-2026"
              className="glass-input text-center font-mono text-base"
            />
            <button type="submit" className="btn-primary w-full py-3.5 text-base inline-flex items-center justify-center gap-2 group">
              <span>Open Election Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="pt-4 border-t border-white/[0.06] text-xs text-slate-400">
            Hosting your own election?{' '}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Create an account
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading election
  if (isLoadingElection) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-cyan-400" />
        <span className="text-xs font-mono text-slate-400">Loading election portal...</span>
      </div>
    );
  }

  // Election Not Found
  if (notFoundError || !election) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel max-w-md w-full p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-white">Election Not Found</h2>
          <p className="text-sm text-slate-300">{notFoundError || `No election matches code "${slug}".`}</p>
          <Link to="/entry" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
            Try Another Code
          </Link>
        </div>
      </div>
    );
  }

  // Kiosk-only notice
  if (election.accessMode === 'kiosk_only') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel max-w-lg w-full p-8 sm:p-10 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Monitor className="w-8 h-8" />
          </div>
          <div className="badge-kicker">
            <span>{election.organization || 'In-Person Election'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">{election.title}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            This election is configured for <strong>In-Person Polling Booth (Kiosk)</strong> voting only. Please cast your ballot at the physical voting station.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to={`/e/${election.slug}/results`} className="btn-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>View Results</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isRosterMode = election.accessMode === 'roster';

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="glass-panel w-full max-w-lg p-8 sm:p-10 relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            {isRosterMode ? <LogIn className="w-7 h-7 text-cyan-400" /> : <Globe className="w-7 h-7 text-cyan-400" />}
          </div>

          <div className="flex items-center justify-center gap-2 mb-2.5 flex-wrap">
            <span className="badge-kicker">
              <span>{election.organization || (isRosterMode ? 'Roster Check' : 'Open Election')}</span>
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              election.isCurrentlyOpen
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {election.isCurrentlyOpen ? 'Voting Open' : 'Voting Closed'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight mb-1.5">
            {election.title}
          </h2>
          {election.description && (
            <p className="text-xs text-slate-400 mb-2 max-w-sm mx-auto">{election.description}</p>
          )}
          <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            {isRosterMode
              ? 'Enter your official Full Name and Enrollment No. or Email to verify against the roster.'
              : 'Enter your Full Name and Email or ID to cast your anonymous ballot (1 vote per person).'}
          </p>
        </div>

        <Alert message={error} type="error" />

        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300">
                Full Name
              </label>
              {isRosterMode && (
                <span className="text-[10px] font-mono font-medium text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Compulsory · Exact Match
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="glass-input pl-10"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Identify By
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 rounded-xl border border-white/[0.08] mb-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('enrollment');
                  setError('');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-heading font-semibold transition-all ${
                  authMethod === 'enrollment'
                    ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <IdCard className="w-3.5 h-3.5" />
                <span>Roll / ID No</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setError('');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-heading font-semibold transition-all ${
                  authMethod === 'email'
                    ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Address</span>
              </button>
            </div>

            {authMethod === 'enrollment' ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IdCard className="w-4 h-4 text-cyan-400" />
                </div>
                <input
                  type="text"
                  required
                  value={credential}
                  onChange={(e) => setCredential(e.target.value.toUpperCase())}
                  placeholder="e.g. 21BCS045 or ROLL-14"
                  className="glass-input pl-10 font-mono"
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4 text-cyan-400" />
                </div>
                <input
                  type="email"
                  required
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="e.g. alex@example.com"
                  className="glass-input pl-10 font-mono text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !election.isCurrentlyOpen}
            className="btn-primary w-full mt-3 py-3.5 group text-base disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </span>
            ) : !election.isCurrentlyOpen ? (
              <span>Voting Currently Closed</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Proceed to Ballot
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRosterMode ? 'Roster Protected' : 'Single-Vote Protected'}</span>
          </span>
          <Link to={`/e/${election.slug}/results`} className="text-cyan-400 hover:text-cyan-300 font-semibold">
            View Standings &rarr;
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default EntryPage;
