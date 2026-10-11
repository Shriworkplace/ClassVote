import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, Maximize2, Minimize2, CheckCircle2, 
  AlertCircle, ChevronRight, Lock, Vote, 
  Volume2, VolumeX, Sparkles, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BallotReviewModal from '../components/BallotReviewModal';
import { offlineVault } from '../utils/offlineVault';

const playEvmBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz authentic tone
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
};

const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
};

const KioskPage = () => {
  const navigate = useNavigate();

  // Election Data
  const [positions, setPositions] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Kiosk Flow States: 'ballot' | 'success'
  const [kioskStep, setKioskStep] = useState('ballot');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [instantVoteMode, setInstantVoteMode] = useState(true);

  // Selections
  const [selectedCandidates, setSelectedCandidates] = useState({});
  const [activePosIdx, setActivePosIdx] = useState(0);
  const [lastVotedSummary, setLastVotedSummary] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [flashedCandidateId, setFlashedCandidateId] = useState(null);

  // Auto-Reset Countdown for in-person queue
  const [countdown, setCountdown] = useState(1);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    loadKioskPositions();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const loadKioskPositions = async () => {
    try {
      const res = await fetch('/api/positions');
      if (res.ok) {
        const loadedPositions = await res.json();
        setPositions(loadedPositions);
        offlineVault.cacheElectionData({ positions: loadedPositions });
      } else {
        const cached = offlineVault.getCachedElectionData();
        if (cached.positions?.length > 0) setPositions(cached.positions);
      }
    } catch {
      // Offline fallback
      const cached = offlineVault.getCachedElectionData();
      if (cached.positions?.length > 0) setPositions(cached.positions);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const submitBallot = useCallback(async (finalSelections) => {
    try {
      setIsSubmitting(true);
      if (soundEnabled) playEvmBeep();

      const selectionsPayload = Object.entries(finalSelections).map(([positionId, candidateId]) => ({
        positionId,
        candidateId
      }));

      if (navigator.onLine) {
        const res = await fetch('/api/kiosk-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selections: selectionsPayload })
        });

        if (!res.ok) {
          offlineVault.saveOfflineBallot({
            selections: finalSelections,
            isKiosk: true
          });
        }
      } else {
        offlineVault.saveOfflineBallot({
          selections: finalSelections,
          isKiosk: true
        });
      }

      setIsReviewOpen(false);
      setKioskStep('success');
      startAutoResetCountdown();
    } catch {
      offlineVault.saveOfflineBallot({
        selections: finalSelections,
        isKiosk: true
      });
      setIsReviewOpen(false);
      setKioskStep('success');
      startAutoResetCountdown();
    } finally {
      setIsSubmitting(false);
    }
  }, [soundEnabled]);

  const handleCandidateAction = useCallback((position, candidate) => {
    const updatedSelections = {
      ...selectedCandidates,
      [position._id]: candidate._id
    };
    setSelectedCandidates(updatedSelections);
    setFlashedCandidateId(candidate._id);
    setTimeout(() => setFlashedCandidateId(null), 300);

    // Track candidate name for confirmation
    setLastVotedSummary(candidate.name);

    if (instantVoteMode) {
      const isLastPosition = activePosIdx >= positions.length - 1;
      const allSelected = positions.every(p => updatedSelections[p._id]);

      if (isLastPosition || allSelected) {
        // Instant 1-click ballot cast!
        submitBallot(updatedSelections);
      } else {
        // Auto-advance to next position in line
        if (soundEnabled) playChime();
        setActivePosIdx(prev => Math.min(prev + 1, positions.length - 1));
      }
    }
  }, [selectedCandidates, instantVoteMode, activePosIdx, positions, soundEnabled, submitBallot]);

  // Keyboard Hotkey Listener for Number & Letter Keys
  useEffect(() => {
    if (kioskStep !== 'ballot' || positions.length === 0 || isSubmitting) return;

    const handleKeyDown = (e) => {
      // Ignore navigation/system hotkeys like Ctrl, Alt, Meta
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentPos = positions[activePosIdx] || positions[0];
      if (!currentPos || !currentPos.candidates || currentPos.candidates.length === 0) return;

      const rawKey = e.key;
      const upperKey = rawKey.toUpperCase();

      let matchedCandidate = null;

      // 1. Check numeric keys (1-9 or Numpad1-9)
      const numMatch = rawKey.replace(/^Numpad/, '');
      const numVal = parseInt(numMatch, 10);
      if (!isNaN(numVal) && numVal >= 1 && numVal <= currentPos.candidates.length) {
        matchedCandidate = currentPos.candidates[numVal - 1];
      } 
      // 2. Check letter keys (A, B, C... or candidate initials)
      else if (upperKey.length === 1 && upperKey >= 'A' && upperKey <= 'Z') {
        const slotIdx = upperKey.charCodeAt(0) - 65; // 'A' -> 0, 'B' -> 1
        if (slotIdx >= 0 && slotIdx < currentPos.candidates.length) {
          matchedCandidate = currentPos.candidates[slotIdx];
        } else {
          // Check by candidate name initial (e.g. 'A' for Alice)
          matchedCandidate = currentPos.candidates.find(
            c => c.name?.trim().charAt(0).toUpperCase() === upperKey
          );
        }
      }

      if (matchedCandidate) {
        e.preventDefault();
        handleCandidateAction(currentPos, matchedCandidate);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [kioskStep, positions, activePosIdx, isSubmitting, handleCandidateAction]);

  const handleOpenReview = () => {
    const unselected = positions.filter(p => !selectedCandidates[p._id]);
    if (unselected.length > 0) {
      setStatusMessage({
        text: `Please select a candidate for all positions (${unselected.length} remaining).`,
        isError: true
      });
      return;
    }
    setStatusMessage({ text: '', isError: false });
    setIsReviewOpen(true);
  };

  const startAutoResetCountdown = () => {
    setCountdown(1);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          resetBallot();
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetBallot = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setSelectedCandidates({});
    setActivePosIdx(0);
    setLastVotedSummary('');
    setStatusMessage({ text: '', isError: false });
    setCountdown(1);
    setKioskStep('ballot');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Kiosk Station Header */}
      <header className="glass-panel-subtle sticky top-0 z-40 px-4 sm:px-8 py-3.5 border-b border-white/[0.08] backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-heading font-bold text-white tracking-tight">
                Voting Booth
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 uppercase font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" /> 1-Click Keypad Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Press 1, 2, 3 or A, B, C on keyboard • No mouse needed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-colors ${
              soundEnabled 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' 
                : 'bg-slate-900 border-white/[0.08] text-slate-500'
            }`}
            title={soundEnabled ? 'EVM Beep Sound Enabled' : 'Sound Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* 1-Click Mode Toggle */}
          <button
            onClick={() => setInstantVoteMode(!instantVoteMode)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors border ${
              instantVoteMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-white/[0.08] text-slate-400'
            }`}
            title="Instant 1-Click casts vote immediately on keypress"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{instantVoteMode ? 'Instant 1-Click: ON' : 'Instant 1-Click: OFF'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'}`} />
            <span className="text-slate-300">{isOnline ? 'Online' : 'Offline Vault'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.08] transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/[0.08] text-xs font-mono transition-colors"
          >
            Exit Booth
          </button>
        </div>
      </header>

      {/* Main Kiosk Viewport */}
      <main className="flex-1 max-w-5xl xl:max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {statusMessage.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            statusMessage.isError 
              ? 'bg-red-500/15 border border-red-500/30 text-red-300' 
              : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
          }`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* STEP 1: DIRECT BALLOT WITH KEYPAD HOTKEYS */}
        {kioskStep === 'ballot' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-6 sm:p-10 space-y-8 rounded-3xl border border-white/[0.12] shadow-2xl"
          >
            {/* Positions List */}
            <div className="space-y-8 max-h-[72vh] overflow-y-auto pr-1.5">
              {positions.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Lock className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-slate-400 text-sm">
                    No election positions currently configured.
                  </p>
                </div>
              ) : (
                positions.map((position, pIdx) => {
                  const isPosActive = pIdx === activePosIdx || positions.length === 1;

                  return (
                    <div 
                      key={position._id} 
                      className={`p-6 sm:p-8 rounded-3xl transition-all ${
                        isPosActive 
                          ? 'bg-slate-950/85 border-2 border-cyan-500/50 shadow-[0_0_32px_rgba(6,182,212,0.18)] ring-1 ring-cyan-500/30' 
                          : 'bg-slate-950/50 border border-white/[0.08] opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-black text-white tracking-tight">
                            {position.name}
                          </h3>
                          {positions.length > 1 && (
                            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-white/[0.06]">
                              Position {pIdx + 1} of {positions.length}
                            </span>
                          )}
                        </div>

                        {selectedCandidates[position._id] ? (
                          <span className="text-xs sm:text-sm font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full font-semibold inline-flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full font-semibold">
                            {isPosActive ? 'Awaiting Keypress' : 'Pending'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                        {position.candidates?.map((candidate, cIdx) => {
                          const isSelected = selectedCandidates[position._id] === candidate._id;
                          const isFlashed = flashedCandidateId === candidate._id;
                          const hotkeyNumber = String(cIdx + 1);
                          const hotkeyLetter = String.fromCharCode(65 + cIdx);
                          const initial = candidate.name?.trim().charAt(0).toUpperCase() || hotkeyLetter;

                          return (
                            <div
                              key={candidate._id}
                              onClick={() => handleCandidateAction(position, candidate)}
                              className={`p-5 sm:p-6 lg:p-7 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-5 select-none relative overflow-hidden group min-h-[170px] ${
                                isFlashed
                                  ? 'bg-cyan-400 text-slate-950 scale-[1.02] shadow-[0_0_36px_rgba(6,182,212,0.85)]'
                                  : isSelected
                                    ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/50'
                                    : 'bg-slate-900/90 hover:bg-slate-850 hover:border-cyan-400/60 border-white/[0.1] shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.01]'
                              }`}
                            >
                              {/* Top Section: Keycap Badge + Candidate Photo/Avatar + Candidate Name */}
                              <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                                {/* Designated EVM Keycap Badge */}
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center font-mono font-black flex-shrink-0 transition-all border-2 shadow-inner ${
                                  isSelected
                                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.6)]'
                                    : 'bg-gradient-to-b from-slate-800 to-slate-900 text-cyan-300 border-white/20 group-hover:border-cyan-400 group-hover:scale-105'
                                }`}>
                                  <span className="text-2xl sm:text-3xl leading-none font-black">{hotkeyNumber}</span>
                                  <span className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold group-hover:text-cyan-300 mt-0.5">
                                    {hotkeyLetter}
                                  </span>
                                </div>

                                {/* Candidate Photo / Avatar */}
                                {candidate.photoUrl ? (
                                  <img
                                    src={candidate.photoUrl}
                                    alt={candidate.name}
                                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl object-cover border-2 border-white/20 flex-shrink-0 shadow-md group-hover:border-cyan-400/50 transition-colors"
                                  />
                                ) : (
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/30 flex items-center justify-center font-heading font-black text-cyan-300 flex-shrink-0 text-2xl sm:text-3xl shadow-md group-hover:border-cyan-400/60 group-hover:scale-105 transition-all">
                                    {initial}
                                  </div>
                                )}

                                {/* Candidate Full Name (Never Truncated) */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white leading-tight group-hover:text-cyan-200 transition-colors uppercase tracking-wide break-words">
                                    {candidate.name}
                                  </div>
                                  <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                    <span>Candidate #{hotkeyNumber}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Bottom Action Bar: Keypad Hint Pill & Dedicated Vote Button */}
                              <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-white/[0.08]">
                                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/25 font-semibold shadow-sm">
                                  <span>Press</span>
                                  <span className="text-white font-black bg-cyan-500/25 px-1.5 py-0.5 rounded border border-cyan-400/40">{hotkeyNumber}</span>
                                  <span>or</span>
                                  <span className="text-white font-black bg-cyan-500/25 px-1.5 py-0.5 rounded border border-cyan-400/40">{hotkeyLetter}</span>
                                </div>

                                <button
                                  type="button"
                                  className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-heading font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md ${
                                    isSelected
                                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.5)] font-black'
                                      : 'bg-slate-800 text-slate-200 group-hover:bg-cyan-400 group-hover:text-slate-950 border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_18px_rgba(6,182,212,0.4)]'
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <Check className="w-4 h-4 stroke-[3]" />
                                      <span>Voted</span>
                                    </>
                                  ) : (
                                    <span>Vote</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Status / Review Bar */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>
                  {instantVoteMode 
                    ? 'Instant Mode Active: Touching any number or letter key immediately casts the vote.'
                    : `Selections: ${Object.keys(selectedCandidates).length} of ${positions.length}`}
                </span>
              </div>

              {!instantVoteMode && (
                <button
                  type="button"
                  onClick={handleOpenReview}
                  className="btn-primary w-full sm:w-auto py-3 px-8 text-sm inline-flex items-center justify-center gap-2 group"
                >
                  <span>Review & Cast Vote</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 2: CELEBRATION & AUTO-RESET SCREEN */}
        {kioskStep === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-8 sm:p-12 text-center space-y-6 max-w-lg mx-auto border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(52,211,153,0.2)]"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_32px_rgba(52,211,153,0.35)] animate-pulse">
              <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
                Vote Recorded Successfully!
              </h2>
              {lastVotedSummary && (
                <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-xs font-mono text-emerald-300 font-semibold">
                  Ballot cast for: {lastVotedSummary}
                </div>
              )}
              <p className="text-sm text-slate-300">
                Your ballot has been securely cast and decoupled from your identity.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.08] text-xs font-mono text-cyan-300 flex items-center justify-center gap-2">
              <span>Screen resetting for next voter in</span>
              <span className="text-white font-bold text-base px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                {countdown}
              </span>
              <span>{countdown === 1 ? 'second...' : 'seconds...'}</span>
            </div>

            <button
              type="button"
              onClick={resetBallot}
              className="btn-primary w-full py-3 text-xs inline-flex items-center justify-center gap-2 group"
            >
              <span>Next Voter Now (Skip Timer)</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </main>

      {/* Review Modal if not in instant mode */}
      <BallotReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onConfirm={() => submitBallot(selectedCandidates)}
        positions={positions}
        selectedCandidates={selectedCandidates}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default KioskPage;
