import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Alert from '../components/Alert';
import { Check, CheckCircle2, ChevronRight, User, ShieldCheck, Loader2, Sparkles } from 'lucide-react';

const VotingPage = () => {
  const [positions, setPositions] = useState([]);
  const [selections, setSelections] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const navigate = useNavigate();
  const voterName = sessionStorage.getItem('voterName');
  const voterEmail = sessionStorage.getItem('voterEmail');

  useEffect(() => {
    if (!voterName || !voterEmail) {
      navigate('/entry');
      return;
    }

    const fetchPositions = async () => {
      try {
        const res = await fetch('/api/positions');
        const data = await res.json();
        setPositions(data);
      } catch (err) {
        setError('Failed to load ballot.');
      }
    };
    fetchPositions();
  }, [navigate, voterName, voterEmail]);

  const handleSelect = (positionId, candidateId) => {
    setSelections(prev => {
      const newSelections = { ...prev };
      if (newSelections[positionId] === candidateId) {
        delete newSelections[positionId];
      } else {
        newSelections[positionId] = candidateId;
      }
      return newSelections;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(selections).length !== positions.length) {
      setError('Please cast a vote for each position before submitting your ballot.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    const submission = Object.keys(selections).map(posId => ({
      positionId: posId,
      candidateId: selections[posId]
    }));

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: voterName, email: voterEmail, selections: submission })
      });
      const data = await res.json();

      if (res.ok) {
        sessionStorage.removeItem('voterName');
        sessionStorage.removeItem('voterEmail');
        setSuccess(data.message);
        setSubmitted(true);
      } else {
        setError(data.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selections).length;
  const totalCount = positions.length;
  const progress = totalCount > 0 ? (selectedCount / totalCount) * 100 : 0;
  const isComplete = totalCount > 0 && selectedCount === totalCount;

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.7 }}
          className="glass-panel w-full max-w-lg p-10 sm:p-12 text-center relative overflow-hidden"
        >
          <div className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          
          <div className="badge-kicker !bg-emerald-500/10 !border-emerald-500/25 !text-emerald-300 mb-3">
            <span>Official Confirmation</span>
          </div>

          <h2 className="text-3xl font-heading font-extrabold text-white mb-3 tracking-tight">
            Ballot Successfully Cast
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-md mx-auto">
            {success || 'Thank you for participating! Your selections have been securely recorded in the election ledger.'}
          </p>
          <button onClick={() => navigate('/results')} className="btn-primary px-8 py-3.5">
            View Live Results
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-32 px-4">
      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -16 }} 
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel mb-10 p-6 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div>
          <div className="badge-kicker mb-2">
            <span>Verified Voter Session</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight">
            Welcome, <span className="text-cyan-400">{voterName}</span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base mt-1 leading-relaxed">
            Please make one selection for each position below to complete your ballot.
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-slate-950/70 p-4 sm:p-5 rounded-xl border border-white/[0.08] w-full md:w-auto min-w-[220px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-400">
              Ballot Progress
            </span>
            <span className="font-mono text-sm font-bold text-cyan-300 tabular-nums">
              {selectedCount} / {totalCount}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${progress}%` }} 
              transition={{ ease: "easeOut", duration: 0.3 }}
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" 
            />
          </div>
        </div>
      </motion.div>

      <Alert message={error} type="error" />

      {positions.length === 0 ? (
        <div className="glass-panel text-center py-20 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-4" />
          <p className="text-slate-300 text-base font-medium">Loading secure ballot options...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-10">
          {positions.map((pos, idx) => {
            const isPositionCompleted = !!selections[pos._id];
            return (
              <motion.div 
                key={pos._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: idx * 0.08 }}
                className={`glass-panel p-6 sm:p-8 transition-all duration-300 ${
                  isPositionCompleted 
                    ? 'border-cyan-500/40 bg-slate-900/80 shadow-[0_8px_32px_rgba(6,182,212,0.08)]' 
                    : ''
                }`}
              >
                {/* Position Title & Status */}
                <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${
                      isPositionCompleted 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 text-slate-400 border border-white/[0.06]'
                    }`}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
                        {pos.name}
                      </h3>
                    </div>
                  </div>
                  
                  <span className={`text-xs font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                    isPositionCompleted 
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' 
                      : 'bg-slate-800/60 text-slate-400 border-white/[0.06]'
                  }`}>
                    {isPositionCompleted ? 'Selected' : 'Required'}
                  </span>
                </div>
                
                {/* Candidates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {pos.candidates.map(cand => {
                    const isSelected = selections[pos._id] === cand._id;
                    const photoSrc = cand.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.name)}&background=0d172e&color=22d3ee&size=240`;
                    
                    return (
                      <motion.div
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        key={cand._id}
                        onClick={() => handleSelect(pos._id, cand._id)}
                        className={`relative cursor-pointer rounded-2xl p-5 text-center border transition-all duration-200 group overflow-hidden ${
                          isSelected 
                            ? 'bg-slate-900/90 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50' 
                            : 'bg-slate-950/50 border-white/[0.08] hover:border-white/[0.2] hover:bg-slate-900/40'
                        }`}
                      >
                        {/* Radio / Check Indicator */}
                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-200 ${
                          isSelected 
                            ? 'bg-cyan-400 border-cyan-300 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.6)]' 
                            : 'border-white/20 bg-slate-800/40 text-transparent group-hover:border-white/40'
                        }`}>
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </div>

                        {/* Candidate Portrait */}
                        <div className="relative mb-4 w-full">
                          <img 
                            src={photoSrc} 
                            alt={cand.name} 
                            className={`w-full h-44 sm:h-48 rounded-xl object-contain bg-slate-950/60 border transition-all duration-200 ${
                              isSelected 
                                ? 'border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.25)]' 
                                : 'border-white/[0.06] group-hover:border-white/[0.12]'
                            }`} 
                          />
                        </div>
                        
                        {/* Candidate Name */}
                        <h4 className={`font-heading font-bold text-lg tracking-tight transition-colors ${
                          isSelected ? 'text-cyan-300' : 'text-white group-hover:text-slate-100'
                        }`}>
                          {cand.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 font-sans">
                          {isSelected ? '✓ Choice Confirmed' : 'Click to select'}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {/* Floating Action Pill */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-6 z-40"
          >
            <div className="glass-panel p-4 sm:p-5 border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] bg-slate-950/90 backdrop-blur-2xl">
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isComplete ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Ballot Status
                  </div>
                  <div className={`font-heading font-bold text-base ${isComplete ? 'text-emerald-300' : 'text-white'}`}>
                    {isComplete ? 'All positions completed' : `${totalCount - selectedCount} position(s) remaining`}
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !isComplete}
                className={`btn-primary w-full sm:w-auto px-8 py-3.5 text-base ${
                  !isComplete ? '!bg-slate-800 !text-slate-400 !border !border-white/[0.06] !shadow-none cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording Ballot...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Submit Final Ballot
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </form>
      )}
    </div>
  );
};

export default VotingPage;
