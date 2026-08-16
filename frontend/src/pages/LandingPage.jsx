import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ShieldCheck, Zap, Vote } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const LandingPage = () => {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center relative overflow-hidden pb-20">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-10 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto text-center px-4 relative z-10 mt-10"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="mb-6 flex justify-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-3xl flex items-center justify-center border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <Vote className="w-12 h-12 text-cyan-400" />
          </div>
        </motion.div>
        
        <motion.h1 
          variants={itemVariants}
          className="text-5xl md:text-7xl font-extrabold font-heading mb-6 leading-tight tracking-tight text-white"
        >
          The Future of <br className="hidden md:block" />
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Class Elections</span>
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="text-lg md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          A seamless, secure, and real-time voting platform designed to empower students and modernize campus elections.
        </motion.p>
        
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24"
        >
          <Link to="/entry" className="w-full sm:w-auto">
            <button className="btn-primary w-full sm:w-auto px-10 py-5 text-xl group flex items-center justify-center">
              Cast Your Vote
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <Link to="/results" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-10 py-5 text-xl font-semibold text-slate-300 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-700 hover:border-slate-500 rounded-xl transition-all shadow-lg hover:shadow-xl backdrop-blur-md">
              View Live Results
            </button>
          </Link>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left"
        >
          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -8 }}
            className="glass-panel p-8 hover:border-cyan-500/30 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20">
              <Zap className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-bold font-heading text-white mb-3">Seamless Experience</h3>
            <p className="text-slate-400 leading-relaxed">
              Designed with a premium glassmorphic interface that makes casting a ballot faster and more intuitive than ever.
            </p>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -8 }}
            className="glass-panel p-8 hover:border-cyan-500/30 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold font-heading text-white mb-3">Secure Voting</h3>
            <p className="text-slate-400 leading-relaxed">
              Robust backend validation ensures every student gets exactly one vote, maintaining the absolute integrity of your election.
            </p>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            whileHover={{ y: -8 }}
            className="glass-panel p-8 hover:border-cyan-500/30 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20">
              <BarChart3 className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold font-heading text-white mb-3">Real-time Results</h3>
            <p className="text-slate-400 leading-relaxed">
              Watch the election unfold live. Our websocket integration updates the public results dashboard instantly as votes are cast.
            </p>
          </motion.div>
        </motion.div>
        
      </motion.div>
    </div>
  );
};

export default LandingPage;
