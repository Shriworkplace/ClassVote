import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Alert from '../components/Alert';
import { LogIn, ArrowRight, Shield, Lock, Loader2 } from 'lucide-react';

const EntryPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem('voterName', name);
        sessionStorage.setItem('voterEmail', email);
        navigate('/voting');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass-panel w-full max-w-md p-8 sm:p-10 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mx-auto flex items-center justify-center mb-5 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <LogIn className="w-7 h-7 text-cyan-400" />
          </div>
          
          <div className="badge-kicker mb-3">
            <span>Roster Check</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight mb-2">
            Voter Authentication
          </h2>
          <p className="text-sm text-slate-300 max-w-xs mx-auto leading-relaxed">
            Enter your official student credentials to access the active election ballot.
          </p>
        </div>

        <Alert message={error} type="error" />

        <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
          <div>
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Full Name
            </label>
            <input 
              type="text" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="glass-input"
            />
          </div>
          
          <div>
            <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Student Email
            </label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex@student.edu"
              className="glass-input"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-primary w-full mt-2 py-3.5 group text-base"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying Roster...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Proceed to Ballot
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Single-vote enforcement active</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default EntryPage;
