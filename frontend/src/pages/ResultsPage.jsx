import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Trophy, Medal, Loader2, Info, Play, X, Radio, Award } from 'lucide-react';
import Confetti from 'react-confetti';

// A small component to animate the number counting up
const Counter = ({ from, to, duration, delay }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let start = null;
    let animationFrame;
    
    const timeout = setTimeout(() => {
      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const currentCount = Math.min(Math.floor((progress / duration) * (to - from) + from), to);
        setCount(currentCount);
        if (progress < duration) {
          animationFrame = requestAnimationFrame(step);
        } else {
          setCount(to);
        }
      };
      animationFrame = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [from, to, duration, delay]);

  return <span className="tabular-nums font-mono">{count}</span>;
};

const ResultsPage = () => {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [hasCounted, setHasCounted] = useState(false);
  const [winnersRevealed, setWinnersRevealed] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch('/api/results');
        const data = await res.json();
        
        if (res.ok) {
          setResults(data);
          setError('');
        } else {
          setResults(null);
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to load results.');
      }
    };

    fetchResults();

    const socket = io();
    socket.on('results-updated', () => {
      fetchResults();
    });

    return () => socket.disconnect();
  }, []);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center mt-16 px-4">
        <div className="glass-panel py-16 px-8 flex flex-col items-center">
           <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-5 text-slate-400 border border-white/[0.06]">
             <Info className="w-7 h-7" />
           </div>
           <h2 className="text-2xl font-heading font-bold text-white mb-2 tracking-tight">Results Currently Unavailable</h2>
           <p className="text-slate-300 text-sm max-w-md leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <span className="text-sm font-medium text-slate-400">Loading verified tallies...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4">
      {/* Header Banner */}
      <div className="glass-panel text-center mb-10 relative overflow-hidden p-8 sm:p-14">
        <div className="badge-kicker mb-3 inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Certified Tallies</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white mb-3">
          Election Standings
        </h2>
        <p className="text-slate-300 text-sm sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
          Tallies are synchronized directly with the database in real-time as student ballots are submitted.
        </p>
        
        {!hasCounted && (
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setHasCounted(true);
              setTimeout(() => {
                setWinnersRevealed(true);
                setShowWinnerModal(true);
              }, 12000); // 12 seconds suspense
            }}
            className="btn-primary px-8 py-4 text-base sm:text-lg flex items-center gap-3 mx-auto"
          >
            <Play className="w-5 h-5 fill-white" />
            Initialize Vote Count
          </motion.button>
        )}
      </div>

      {/* Position Breakdown */}
      <div className="space-y-10">
        {results.map((pos, idx) => {
          const displayCandidates = [...pos.candidates].sort((a, b) => a.name.localeCompare(b.name));
          const maxVotes = Math.max(...pos.candidates.map(c => c.votes));
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              key={pos.name}
              className="glass-panel overflow-hidden"
            >
              {/* Header Bar */}
              <div className="bg-slate-950/60 px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
                    POS {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-lg sm:text-xl font-heading font-bold text-white tracking-tight">
                    {pos.name}
                  </h3>
                </div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-white/[0.08] text-xs font-medium text-slate-300">
                  <span className="text-slate-400">Total Ballots:</span>
                  <span className="text-white font-mono font-bold">
                    {hasCounted ? <Counter from={0} to={pos.totalVotes} duration={6000} delay={0} /> : 0}
                  </span>
                </div>
              </div>
              
              {/* Chart Body */}
              <div className="p-6 sm:p-8">
                {!hasCounted ? (
                  <div className="h-56 flex flex-col items-center justify-center border border-dashed border-white/[0.08] rounded-xl bg-slate-950/30 gap-2">
                     <Radio className="w-6 h-6 text-slate-500 animate-pulse" />
                     <p className="text-slate-400 text-sm font-medium">Awaiting Count Initialization...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-4">
                    <div className="flex justify-around items-end h-[340px] gap-6 mt-4 px-2 md:px-6 min-w-max md:min-w-full">
                      {displayCandidates.map((cand, i) => {
                        const percentage = pos.totalVotes === 0 ? 0 : Math.round((cand.votes / pos.totalVotes) * 100);
                        const isWinner = winnersRevealed && cand.votes === maxVotes && pos.totalVotes > 0;
                        const animationDelay = i * 2.0; 
                        
                        return (
                          <div key={cand.candidateId} className="flex flex-col items-center justify-end h-full w-full max-w-[110px] md:max-w-[150px]">
                            
                            {/* Animated Numbers */}
                            <motion.div 
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: animationDelay + 0.8 }}
                              className="mb-3 text-center"
                            >
                              <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white block tracking-tight tabular-nums">
                                <Counter from={0} to={percentage} duration={4000} delay={animationDelay} />%
                              </span>
                              <span className="text-xs font-mono text-slate-400 font-medium">
                                <Counter from={0} to={cand.votes} duration={4000} delay={animationDelay} /> votes
                              </span>
                            </motion.div>

                            {/* Vertical Bar */}
                            <div className="w-full bg-slate-950/80 rounded-t-xl relative flex-1 max-h-[210px] border border-white/[0.06]">
                              <motion.div
                                initial={{ height: "0%" }}
                                animate={{ height: `${percentage}%` }}
                                transition={{ duration: 5.5, ease: [0.16, 1, 0.3, 1], delay: animationDelay }}
                                className={`absolute bottom-0 left-0 w-full rounded-t-xl transition-all duration-1000 ${
                                  isWinner 
                                    ? 'bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.6)]' 
                                    : 'bg-slate-700/80'
                                }`}
                              />
                            </div>
                            
                            {/* Candidate Label */}
                            <div className="mt-3.5 text-center h-16 flex flex-col items-center w-full">
                              {isWinner && (
                                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
                                  <Trophy className="w-5 h-5 text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                                </motion.div>
                              )}
                              
                              <span className={`font-heading font-semibold text-sm leading-tight px-1 transition-colors duration-700 ${isWinner ? 'text-cyan-300 font-bold' : 'text-slate-300'} text-center line-clamp-2`}>
                                {cand.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Winner Celebration Modal */}
      <AnimatePresence>
        {showWinnerModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <Confetti 
              width={windowDimensions.width} 
              height={windowDimensions.height} 
              recycle={false} 
              numberOfPieces={500} 
              gravity={0.12} 
            />
            
            <motion.div 
              initial={{ scale: 0.92, y: 16 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-panel p-6 sm:p-10 border-amber-500/40 shadow-[0_0_60px_rgba(245,158,11,0.25)]"
            >
              <button 
                onClick={() => setShowWinnerModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-300 transition-colors z-10 border border-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-8 mt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
                  <Award className="w-3.5 h-3.5" />
                  <span>Official Election Outcome</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-heading font-black text-white tracking-tight mb-2">
                  Elected Representatives
                </h2>
                <p className="text-slate-300 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                  Congratulations to the newly elected student candidates!
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                {results && results.map((pos, idx) => {
                  const maxVotes = Math.max(...pos.candidates.map(c => c.votes));
                  const winner = pos.candidates.find(c => c.votes === maxVotes && pos.totalVotes > 0);
                  if (!winner) return null;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + (idx * 0.15) }}
                      key={pos.name} 
                      className="flex flex-col items-center p-6 bg-slate-950/70 rounded-2xl border border-white/[0.1] w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.33%-1rem)] relative overflow-hidden"
                    >
                      <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-amber-400 mb-4 shadow-[0_0_24px_rgba(245,158,11,0.3)] bg-slate-900">
                        {winner.photoUrl ? (
                          <img src={winner.photoUrl} alt={winner.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs">No Photo</div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                        <Trophy className="w-4 h-4" />
                        <span className="font-mono text-xs uppercase tracking-wider font-semibold">Winner</span>
                      </div>
                      
                      <h3 className="text-lg font-heading font-bold text-white text-center mb-1 leading-snug">
                        {winner.name}
                      </h3>
                      <p className="text-cyan-300 text-xs font-medium text-center">{pos.name}</p>
                      
                      <div className="mt-3 pt-3 border-t border-white/[0.06] w-full text-center">
                        <span className="font-mono text-xs text-slate-400 font-medium">
                          <strong className="text-white tabular-nums">{winner.votes}</strong> verified votes
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResultsPage;
