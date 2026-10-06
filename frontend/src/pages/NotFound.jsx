import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Vote, BarChart3, HelpCircle } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel w-full max-w-xl p-8 sm:p-12 text-center relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/10 blur-3xl pointer-events-none -z-10 rounded-full"></div>

        {/* 404 Visual Pill */}
        <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono text-xs uppercase tracking-widest mb-6">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          Error 404 • Resource Missing
        </div>

        {/* Big 404 Typography */}
        <h1 className="text-6xl sm:text-8xl font-heading font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 mb-4 drop-shadow-[0_0_24px_rgba(6,182,212,0.3)]">
          404
        </h1>

        <h2 className="text-xl sm:text-2xl font-heading font-bold text-white mb-3 tracking-tight">
          Page or Ballot Not Found
        </h2>

        <p className="text-sm text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
          The election link or page you are trying to reach does not exist, may have closed, or was moved. Use the quick shortcuts below to find your way back.
        </p>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/"
            className="btn-secondary !py-2.5 !px-4 text-xs inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4 text-slate-400" />
            Home
          </Link>
          <Link
            to="/entry"
            className="btn-primary !py-2.5 !px-4 text-xs inline-flex items-center justify-center gap-2"
          >
            <Vote className="w-4 h-4" />
            Voter Portal
          </Link>
          <Link
            to="/results"
            className="btn-secondary !py-2.5 !px-4 text-xs inline-flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Live Standings
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
