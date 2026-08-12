import { Link } from 'react-router-dom';
import { Vote } from 'lucide-react';

const Header = () => {
  return (
    <header className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 sticky top-0 z-50 py-4 px-6 mb-8 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-4 group">
        <div className="group-hover:scale-110 transition-transform">
          <img src="/logo.png" alt="ClassVote Logo" className="w-12 h-12 object-contain rounded-xl" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-heading">
          ClassVote
        </h1>
      </Link>
    </header>
  );
};

export default Header;
