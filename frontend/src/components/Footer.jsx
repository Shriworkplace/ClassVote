import { Link } from 'react-router-dom';
import { Shield, ArrowUpRight, Vote } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="mt-20 border-t border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 grid gap-10 md:grid-cols-12">
        
        {/* Brand & Privacy Summary */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.jpeg" 
              alt="ClassVote Logo" 
              className="w-7 h-7 object-contain rounded-lg border border-cyan-400/20 bg-white"
            />
            <span className="font-heading font-bold text-lg text-white tracking-tight">ClassVote</span>
          </div>
          
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg font-sans">
            ClassVote is an encrypted campus voting platform. Student credentials are cross-referenced 
            solely for roster verification, preventing duplicate ballots and guaranteeing election integrity.
          </p>

          <div>
            <Link
              to="/privacy-policy"
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-heading font-semibold uppercase tracking-wider transition-colors group"
            >
              <span>Read Full Privacy Notice</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Development Team & System Info */}
        <div className="md:col-span-5 space-y-4 md:border-l md:border-white/[0.06] md:pl-8">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-400">
            System & Engineering
          </h4>
          
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-400 text-xs uppercase font-medium">Backend:</span>
              <a
                href="https://shriworkplace.github.io/"
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-cyan-300 font-medium transition-colors inline-flex items-center gap-1"
              >
                Shrived Dhone <ArrowUpRight className="w-3 h-3 text-slate-500" />
              </a>
            </div>
            
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-400 text-xs uppercase font-medium">Frontend:</span>
              <span className="text-white font-medium">Siya Giri</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
            <span>React • Express • MongoDB • Socket.io</span>
            <span>&copy; {new Date().getFullYear()} ClassVote</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;