import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Alert from '../components/Alert';
import { LogIn, ArrowRight, ShieldCheck, Lock, Loader2, User, Mail, IdCard } from 'lucide-react';

const EntryPage = () => {
  const [name, setName] = useState('');
  const [authMethod, setAuthMethod] = useState('enrollment'); // 'enrollment' or 'email'
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanName = name.trim();
    const cleanCredential = credential.trim();

    if (!cleanName) {
      setError('Full Name is compulsory and required.');
      setIsLoading(false);
      return;
    }

    if (!cleanCredential) {
      setError(`Please enter your ${authMethod === 'enrollment' ? 'Enrollment Number (En no.)' : 'College Email'}.`);
      setIsLoading(false);
      return;
    }

    // Smart detection: if user types an email or enrollment number
    const isEmailFormat = cleanCredential.includes('@');
    const payload = {
      name: cleanName,
      identifier: cleanCredential,
      ...(isEmailFormat ? { email: cleanCredential.toLowerCase() } : { enrollmentNo: cleanCredential.toUpperCase() })
    };

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem('voterName', data.voter?.name || cleanName);
        if (data.voter?.email) {
          sessionStorage.setItem('voterEmail', data.voter.email);
        } else if (isEmailFormat) {
          sessionStorage.setItem('voterEmail', cleanCredential.toLowerCase());
        }
        if (data.voter?.enrollmentNo) {
          sessionStorage.setItem('voterEnrollmentNo', data.voter.enrollmentNo);
        } else if (!isEmailFormat) {
          sessionStorage.setItem('voterEnrollmentNo', cleanCredential.toUpperCase());
        }
        navigate('/voting');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred during verification. Please try again.');
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
        className="glass-panel w-full max-w-lg p-8 sm:p-10 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="text-center mb-6 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <LogIn className="w-7 h-7 text-cyan-400" />
          </div>
          
          <div className="badge-kicker mb-2.5">
            <span>Roster Check</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight mb-2">
            Voter Authentication
          </h2>
          <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            Enter your official Full Name and <strong>Enrollment No. / Roll No.</strong> to access your ballot.
          </p>
        </div>

        <Alert message={error} type="error" />

        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          {/* Full Name Field - Compulsory */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300">
                Full Name
              </label>
              <span className="text-[10px] font-mono font-medium text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Compulsory · Exact Match
              </span>
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
            <p className="text-[11px] text-slate-400 mt-1">
              Must match your official college registered name exactly.
            </p>
          </div>

          {/* Credential Method Switcher: Roll No / En No OR Email */}
          <div className="pt-2">
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
                <span>Roll No / En No</span>
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
                <span>College Email</span>
              </button>
            </div>

            {authMethod === 'enrollment' ? (
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <IdCard className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={credential}
                    onChange={(e) => setCredential(e.target.value.toUpperCase())}
                    placeholder="e.g. 21BCS045, Roll 14, or EN2024001"
                    className="glass-input pl-10 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your official university enrollment number or roll number.
                </p>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input 
                    type="email" 
                    required 
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    placeholder="e.g. alex@college.edu"
                    className="glass-input pl-10 font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your college email address (if registered).
                </p>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-primary w-full mt-3 py-3.5 group text-base"
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

        <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Single-vote enforcement</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Roster Protected</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default EntryPage;


