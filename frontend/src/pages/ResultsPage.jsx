import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Trophy, Medal, Loader2, Info, Play, X } from 'lucide-react';
import Confetti from 'react-confetti';

// A small component to animate the number counting up
const Counter = ({ from, to, duration, delay }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let start = null;
    let animationFrame;
    
    // Wait for the delay before starting the count
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

  return <span>{count}</span>;
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
      <div className="max-w-2xl mx-auto text-center mt-20">
        <div className="glass-panel py-16 flex flex-col items-center">
           <Info className="w-16 h-16 text-slate-500 mb-6" />
           <h2 className="text-2xl font-bold text-slate-300 mb-2">Results Unavailable</h2>
           <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="glass-panel text-center mb-12 relative overflow-hidden p-10 md:p-16">
        <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-heading">
          Election Results
        </h2>
        <p className="text-slate-400 text-lg md:text-xl mb-10">Updates automatically in real-time as votes are cast.</p>
        
        {!hasCounted && (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setHasCounted(true);
              setTimeout(() => {
                setWinnersRevealed(true);
                setShowWinnerModal(true);
              }, 12000); // Wait 12 seconds for suspense
            }}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-10 py-4 text-xl rounded-full font-bold shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-4 mx-auto"
          >
            <Play className="w-6 h-6 fill-white" />
            Start Vote Count
          </motion.button>
        )}
      </div>

      <div className="space-y-12">
        {results.map((pos, idx) => {
          // Sort alphabetically so the display order is stable but hides who is winning
          const displayCandidates = [...pos.candidates].sort((a, b) => a.name.localeCompare(b.name));
          const maxVotes = Math.max(...pos.candidates.map(c => c.votes));
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={pos.name}
              className="glass-panel overflow-hidden"
            >
              <div className="bg-slate-900/50 p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-3 font-heading">
                  <span className="text-cyan-500 font-normal opacity-50">#{idx + 1}</span>
                  {pos.name}
                </h3>
                <div className="px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm font-medium text-slate-300">
                  Total Votes: <span className="text-white font-bold ml-1">{hasCounted ? <Counter from={0} to={pos.totalVotes} duration={6000} delay={0} /> : 0}</span>
                </div>
              </div>
              
              <div className="p-6">
                {!hasCounted ? (
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                     <p className="text-slate-500 font-medium">Awaiting Count Initialization...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <div className="flex justify-around items-end h-[350px] gap-8 mt-8 px-2 md:px-8 min-w-max md:min-w-full">
                      {displayCandidates.map((cand, i) => {
                      const percentage = pos.totalVotes === 0 ? 0 : Math.round((cand.votes / pos.totalVotes) * 100);
                      const isWinner = winnersRevealed && cand.votes === maxVotes && pos.totalVotes > 0;
                      // Stagger the bars significantly more to build tension
                      const animationDelay = i * 2.0; 
                      
                      return (
                        <div key={cand.candidateId} className="flex flex-col items-center justify-end h-full w-full max-w-[100px] md:max-w-[140px]">
                          
                          {/* Count Animation */}
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: animationDelay + 1.0 }}
                            className="mb-3 text-center"
                          >
                            <span className="text-2xl font-bold text-white block">
                              <Counter from={0} to={percentage} duration={4000} delay={animationDelay} />%
                            </span>
                            <span className="text-sm text-slate-400 font-medium">
                              <Counter from={0} to={cand.votes} duration={4000} delay={animationDelay} /> votes
                            </span>
                          </motion.div>

                          {/* Vertical Bar */}
                          <div className="w-full bg-slate-800 rounded-t-2xl relative flex-1 max-h-[220px]">
                            <motion.div
                              initial={{ height: "0%" }}
                              animate={{ height: `${percentage}%` }}
                              // Slow, dramatic easing curve
                              transition={{ duration: 6, ease: [0.16, 1, 0.3, 1], delay: animationDelay }}
                              className={`absolute bottom-0 left-0 w-full rounded-t-2xl transition-all duration-1000 ${
                                isWinner 
                                  ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)]' 
                                  : 'bg-slate-600'
                              }`}
                            />
                          </div>
                          
                          {/* Label */}
                          <div className="mt-4 text-center h-16 flex flex-col items-center w-full">
                            {isWinner && (
                              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
                                <Trophy className="w-6 h-6 text-yellow-400 mb-1 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                              </motion.div>
                            )}
                            
                            <span className={`font-bold text-sm leading-tight px-1 transition-colors duration-1000 ${isWinner ? 'text-white' : 'text-slate-300'} text-center line-clamp-2`}>
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

      <AnimatePresence>
        {showWinnerModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <Confetti 
              width={windowDimensions.width} 
              height={windowDimensions.height} 
              recycle={false} 
              numberOfPieces={600} 
              gravity={0.15} 
            />
            
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto glass-panel p-8 md:p-12 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
            >
              <button 
                onClick={() => setShowWinnerModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-10 mt-4">
                <h2 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent font-heading drop-shadow-lg">
                  ELECTION WINNERS
                </h2>
                <p className="text-slate-300 text-lg md:text-xl">Congratulations to the newly elected candidates!</p>
              </div>

              <div className="flex flex-wrap justify-center gap-8">
                {results && results.map((pos, idx) => {
                  const maxVotes = Math.max(...pos.candidates.map(c => c.votes));
                  const winner = pos.candidates.find(c => c.votes === maxVotes && pos.totalVotes > 0);
                  if (!winner) return null;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + (idx * 0.2) }}
                      key={pos.name} 
                      className="flex flex-col items-center p-8 bg-slate-900/60 rounded-3xl border border-white/10 w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.33%-1.5rem)]"
                    >
                      <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-yellow-500 mb-6 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                        {winner.photoUrl ? (
                          <img src={winner.photoUrl} alt={winner.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">No Photo</div>
                        )}
                      </div>
                      <Trophy className="w-10 h-10 text-yellow-400 mb-3 drop-shadow-md" />
                      <h3 className="text-2xl font-bold text-white text-center mb-1 leading-tight">{winner.name}</h3>
                      <p className="text-cyan-400 font-medium text-center">{pos.name}</p>
                      <p className="text-slate-400 text-sm mt-3">{winner.votes} votes</p>
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
