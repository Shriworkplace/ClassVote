import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogIn, UserPlus, Hash } from 'lucide-react';
import { UserButton } from '@clerk/react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 py-3 px-4 sm:px-8 mb-8 backdrop-blur-2xl bg-slate-950/75 border-b border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <img
              src="/logo.jpeg"
              alt="ClassVote Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-400/30 group-hover:scale-105 group-hover:border-cyan-400/60 transition-all duration-300 bg-white"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Class<span className="text-cyan-400 font-black">Vote</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Platform
              </span>
            </div>
          </div>
        </Link>

        {/* Navigation / Auth Actions */}
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/entry"
            className={`text-xs sm:text-sm font-medium tracking-wide px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              location.pathname === '/entry'
                ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Join Election</span>
            <span className="sm:hidden">Join</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className={`text-xs sm:text-sm font-heading font-semibold tracking-wide px-3.5 py-2 rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  location.pathname.startsWith('/dashboard')
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>My Elections</span>
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-9 h-9 border border-cyan-400/40 shadow-sm rounded-xl'
                  }
                }}
              />
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={`text-xs sm:text-sm font-medium tracking-wide px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                  location.pathname === '/login'
                    ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/signup"
                className="hidden sm:inline-flex btn-primary px-3.5 py-2 text-xs font-semibold items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
