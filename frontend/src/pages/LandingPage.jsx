import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Hash, LayoutDashboard, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../utils/usePageMeta';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } }
};

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  usePageMeta({
    title: 'Run Verified Elections for Class, Club & Team',
    description: 'ClassVote is a modern, real-time voting platform built for university clubs, student councils, and team elections. Run verified online ballots or in-person EVM kiosks with instant live results.',
    robots: 'index, follow'
  });

  const handleJoin = (e) => {
    e.preventDefault();
    const cleaned = joinCode
      .trim()
      .replace(/^https?:\/\/[^/]+\/e\//i, '')
      .replace(/^\/?e\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
    if (!cleaned) return;
    navigate(`/e/${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center relative overflow-hidden pb-16">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto text-center px-4 relative z-10 pt-4"
      >
        <motion.div variants={itemVariants} className="mb-6 flex justify-center">
          <div className="badge-kicker">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Self-Service Voting Platform for Everyone</span>
          </div>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-6xl md:text-7xl font-heading font-black tracking-tight text-white mb-6 leading-[1.08]"
        >
          Run verified elections <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            for any class, club, or team.
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-base sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-sans font-normal"
        >
          Sign up in seconds to create your own isolated election workspace, share a QR code or link, run an in-person EVM kiosk, and stream real-time tallies.
        </motion.p>

        {/* Primary Organizer CTAs */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          {user ? (
            <Link to="/dashboard" className="w-full sm:w-auto">
              <button className="btn-primary w-full sm:w-auto px-8 py-4 text-base sm:text-lg group inline-flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 mr-2.5" />
                Open My Elections
                <ArrowRight className="w-5 h-5 ml-2.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          ) : (
            <>
              <Link to="/signup" className="w-full sm:w-auto">
                <button className="btn-primary w-full sm:w-auto px-8 py-4 text-base sm:text-lg group">
                  Create Free Election
                  <ArrowRight className="w-5 h-5 ml-2.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <button className="btn-secondary w-full sm:w-auto px-8 py-4 text-base sm:text-lg">
                  Organizer Sign In
                </button>
              </Link>
            </>
          )}
        </motion.div>

        {/* Quick Join by Election Code */}
        <motion.form
          variants={itemVariants}
          onSubmit={handleJoin}
          className="max-w-md mx-auto mb-20 glass-panel p-2.5 flex items-center gap-2 border border-cyan-500/25 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
        >
          <div className="pl-2.5 text-cyan-400">
            <Hash className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Have an election code? e.g. cs-2026"
            className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none flex-1 font-mono py-2"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-heading font-bold uppercase tracking-wider transition-colors"
          >
            Vote
          </button>
        </motion.form>

        {/* Feature Highlights Grid */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
        >
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="glass-panel p-7 relative group hover:border-cyan-500/30"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Zap className="w-6 h-6" />
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">01 / SELF-SERVICE</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              Unlimited Elections
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Every organizer gets an isolated workspace with custom election codes, shareable QR posters, and flexible roster or open-link modes.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="glass-panel p-7 relative group hover:border-emerald-500/30"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">02 / SECRET BALLOT</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              Verified & Anonymous
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Strict per-election duplicate prevention guarantees one ballot per voter while keeping candidate selections completely anonymous.
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="glass-panel p-7 relative group hover:border-blue-500/30"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Monitor className="w-6 h-6" />
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">03 / ONLINE + BOOTH</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              Mobile QR & EVM Kiosk
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Let voters scan from their phones or run a rapid in-person voting booth with offline resilience and live WebSocket standings.
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
