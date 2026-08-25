import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 py-3 px-4 sm:px-8 mb-8 backdrop-blur-2xl bg-slate-950/75 border-b border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="relative">
            <img 
              src="/logo.jpeg" 
              alt="ClassVote Logo" 
              className="w-11 h-11 object-contain rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-400/30 group-hover:scale-105 group-hover:border-cyan-400/60 transition-all duration-300 bg-white"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-2xl tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Class<span className="text-cyan-400 font-black">Vote</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Official
              </span>
            </div>
          </div>
        </Link>

        {/* Navigation / Quick Actions */}
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link 
            to="/results" 
            className={`text-xs sm:text-sm font-medium tracking-wide px-3.5 py-2 rounded-lg transition-colors ${
              location.pathname === '/results'
                ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Live Results
          </Link>
          <Link 
            to="/entry" 
            className="text-xs sm:text-sm font-heading font-semibold tracking-wide bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-lg shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all"
          >
            Vote Now
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
