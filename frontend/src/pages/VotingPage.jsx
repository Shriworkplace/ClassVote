import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Alert from '../components/Alert';
import { Check, CheckCircle2, ChevronRight, User } from 'lucide-react';

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
      setError('Please select one candidate for every position.');
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

  const progress = positions.length > 0 ? (Object.keys(selections).length / positions.length) * 100 : 0;

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="glass-panel w-full max-w-lg p-12 text-center border-t-4 border-t-emerald-500"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-4 font-heading">Vote Confirmed</h2>
          <p className="text-slate-400 mb-8">{success}</p>
          <button onClick={() => navigate('/')} className="btn-primary px-8">Return to Home</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-32">
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel mb-12 p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8"
      >
        <div>
          <h2 className="text-4xl md:text-5xl font-bold font-heading mb-3 text-white">Welcome, <span className="text-cyan-400">{voterName}</span></h2>
          <p className="text-slate-400 text-lg">Please cast your vote for all listed positions below.</p>
        </div>
        <div className="bg-slate-900/80 px-8 py-6 rounded-2xl border border-slate-700/50 flex flex-col items-start md:items-end w-full md:w-auto">
           <span className="text-base text-slate-400 font-medium mb-3">Your Progress</span>
           <div className="flex items-center gap-4 w-full md:min-w-[250px]">
              <div className="h-3 flex-1 bg-slate-800 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} 
                    className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]" 
                 />
              </div>
              <span className="font-bold text-xl text-cyan-400">{Object.keys(selections).length}/{positions.length}</span>
           </div>
        </div>
      </motion.div>

      <Alert message={error} type="error" />

      {positions.length === 0 ? (
        <div className="glass-panel text-center py-16 flex flex-col items-center justify-center">
           <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
           <p className="text-slate-400 text-lg">Loading secure ballot...</p>
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
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: idx * 0.1 }}
                className={`glass-panel overflow-hidden transition-colors duration-500 ${isPositionCompleted ? 'border-cyan-500/30 bg-slate-900/80' : ''}`}
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${
                    isPositionCompleted 
                      ? 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {idx + 1}
                  </div>
                  <h3 className="text-2xl font-bold font-heading text-white">{pos.name}</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {pos.candidates.map(cand => {
                    const isSelected = selections[pos._id] === cand._id;
                    const photoSrc = cand.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.name)}&background=1e293b&color=06b6d4&size=200`;
                    
                    return (
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        key={cand._id}
                        onClick={() => handleSelect(pos._id, cand._id)}
                        className={`relative cursor-pointer rounded-2xl p-6 text-center border-2 transition-all duration-300 group overflow-hidden ${
                          isSelected 
                            ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.15)]' 
                            : 'bg-slate-900/40 border-slate-700/50 hover:border-cyan-500/40'
                        }`}
                      >
                        {/* Glow effect in background when selected */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-cyan-500/5 blur-2xl" />
                        )}

                        {/* Checkbox Icon */}
                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isSelected 
                            ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
                            : 'border-slate-600 group-hover:border-cyan-500/50 bg-slate-800/50'
                        }`}>
                          <Check className={`w-3.5 h-3.5 text-slate-900 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                        </div>

                        <div className="relative mb-5 w-full">
                          <img 
                            src={photoSrc} 
                            alt={cand.name} 
                            className={`w-full h-48 sm:h-56 rounded-xl object-contain bg-slate-900/50 border-4 transition-all duration-300 ${
                              isSelected ? 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105' : 'border-slate-800'
                            }`} 
                          />
                        </div>
                        
                        <h4 className={`font-bold text-xl mb-1 transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>{cand.name}</h4>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-6 z-40"
          >
            <div className="glass-panel border-cyan-500/30 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900/90 backdrop-blur-2xl">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    progress === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {progress === 100 ? <CheckCircle2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 font-medium">Ballot Status</div>
                    <div className={`font-bold ${progress === 100 ? 'text-emerald-400' : 'text-white'}`}>
                      {progress === 100 ? 'Ready to Submit' : 'Incomplete'}
                    </div>
                  </div>
               </div>
               <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                    progress === 100 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Ballot'}
                  {!isSubmitting && <ChevronRight className="w-5 h-5" />}
                </button>
            </div>
          </motion.div>
        </form>
      )}
    </div>
  );
};

export default VotingPage;
