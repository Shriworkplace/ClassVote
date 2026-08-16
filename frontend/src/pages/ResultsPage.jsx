import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Trophy, Medal, Loader2, Info, Play } from 'lucide-react';

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
      <div className="glass-panel text-center mb-12 relative overflow-hidden">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-heading">
          Election Results
        </h2>
        <p className="text-slate-400 mb-6">Updates automatically in real-time as votes are cast.</p>
        
        {!hasCounted && (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHasCounted(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-3 mx-auto"
          >
            <Play className="w-5 h-5 fill-white" />
            Start Vote Count
          </motion.button>
        )}
      </div>

      <div className="space-y-12">
        {results.map((pos, idx) => {
          const sortedCandidates = [...pos.candidates].sort((a, b) => b.votes - a.votes);
          
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
                  Total Votes: <span className="text-white font-bold ml-1">{hasCounted ? <Counter from={0} to={pos.totalVotes} duration={2000} delay={0} /> : 0}</span>
                </div>
              </div>
              
              <div className="p-6">
                {!hasCounted ? (
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                     <p className="text-slate-500 font-medium">Awaiting Count Initialization...</p>
                  </div>
                ) : (
                  <div className="flex justify-around items-end h-[350px] gap-4 mt-8 px-2 md:px-8">
                    {sortedCandidates.map((cand, i) => {
                      const percentage = pos.totalVotes === 0 ? 0 : Math.round((cand.votes / pos.totalVotes) * 100);
                      const isFirst = i === 0 && pos.totalVotes > 0;
                      const animationDelay = i * 0.3; // Stagger the bars
                      
                      return (
                        <div key={cand.candidateId} className="flex flex-col items-center justify-end h-full w-full max-w-[100px] md:max-w-[140px]">
                          
                          {/* Count Animation */}
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: animationDelay + 0.5 }}
                            className="mb-3 text-center"
                          >
                            <span className="text-2xl font-bold text-white block">
                              <Counter from={0} to={percentage} duration={1500} delay={animationDelay} />%
                            </span>
                            <span className="text-sm text-slate-400 font-medium">
                              <Counter from={0} to={cand.votes} duration={1500} delay={animationDelay} /> votes
                            </span>
                          </motion.div>

                          {/* Vertical Bar */}
                          <div className="w-full bg-slate-800 rounded-t-2xl relative flex-1 max-h-[220px]">
                            <motion.div
                              initial={{ height: "0%" }}
                              animate={{ height: `${percentage}%` }}
                              transition={{ duration: 2, ease: [0.22, 1, 0.36, 1], delay: animationDelay }}
                              className={`absolute bottom-0 left-0 w-full rounded-t-2xl ${
                                isFirst 
                                  ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)]' 
                                  : 'bg-slate-600'
                              }`}
                            />
                          </div>
                          
                          {/* Label */}
                          <div className="mt-4 text-center h-16 flex flex-col items-center w-full">
                            {isFirst && <Trophy className="w-5 h-5 text-yellow-400 mb-1" />}
                            {i === 1 && pos.totalVotes > 0 && <Medal className="w-5 h-5 text-slate-400 mb-1" />}
                            {i === 2 && pos.totalVotes > 0 && <Medal className="w-5 h-5 text-amber-700 mb-1" />}
                            
                            <span className={`font-bold text-sm leading-tight px-1 ${isFirst ? 'text-white' : 'text-slate-300'} text-center line-clamp-2`}>
                              {cand.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsPage;
