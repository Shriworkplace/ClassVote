import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ShieldCheck, Zap, Vote, Sparkles, CheckCircle2 } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } }
};

const LandingPage = () => {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center relative overflow-hidden pb-16">
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto text-center px-4 relative z-10 pt-4"
      >
        {/* Kicker Badge */}
        <motion.div variants={itemVariants} className="mb-6 flex justify-center">
          <div className="badge-kicker">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Official Student Voting Platform</span>
          </div>
        </motion.div>
        
        {/* Main Headline */}
        <motion.h1 
          variants={itemVariants}
          className="text-4xl sm:text-6xl md:text-7xl font-heading font-black tracking-tight text-white mb-6 leading-[1.08]"
        >
          Campus elections, <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            seamless, verified & live.
          </span>
        </motion.h1>
        
        {/* Subtitle */}
        <motion.p 
          variants={itemVariants}
          className="text-base sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-sans font-normal"
        >
          Cast your ballot securely in seconds. Backed by real-time roster verification and transparent live result tallies.
        </motion.p>
        
        {/* Call to Actions */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <Link to="/entry" className="w-full sm:w-auto">
            <button className="btn-primary w-full sm:w-auto px-8 py-4 text-base sm:text-lg group">
              Cast Your Ballot
              <ArrowRight className="w-5 h-5 ml-2.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <Link to="/results" className="w-full sm:w-auto">
            <button className="btn-secondary w-full sm:w-auto px-8 py-4 text-base sm:text-lg flex items-center justify-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              View Live Standings
            </button>
          </Link>
        </motion.div>

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
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">01 / FAST</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              One-Click Voting
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Intuitive, mobile-responsive ballot interface that guides you smoothly through all positions without hassle.
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
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">02 / INTEGRITY</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              Verified Integrity
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Automated roster matching ensures strictly one vote per student, eliminating fraud and duplicate entries.
            </p>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="glass-panel p-7 relative group hover:border-blue-500/30"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider">03 / REAL-TIME</span>
            </div>
            <h3 className="text-xl font-heading font-bold text-white mb-2 tracking-tight">
              Live Synchronization
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Instant websocket tallies update election standings in real-time as soon as votes are officially submitted.
            </p>
          </motion.div>
        </motion.div>
        
      </motion.div>
    </div>
  );
};

export default LandingPage;
