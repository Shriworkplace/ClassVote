import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-white/10 bg-slate-950/60 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-2">
        <section>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80 mb-3">Privacy Policy</p>
          <p className="text-slate-400 text-sm leading-6 max-w-xl">
            ClassVote collects the name and email a voter submits, the positions they vote on,
            and the selected candidate for each position. This information is used only to verify
            eligibility, prevent duplicate voting, and record election results.
          </p>
          <Link
            to="/privacy-policy"
            className="inline-flex items-center mt-4 text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-colors"
          >
            Read the full privacy policy
          </Link>
        </section>

        <section>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80 mb-3">Development Team</p>
          <div className="space-y-2 text-sm text-slate-400 leading-6">
            <p>
              <span className="font-medium text-slate-300">Backend:</span>{' '}
              <a
                href="https://shriworkplace.github.io/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Shrived Dhone
              </a>
            </p>
            <p>
              <span className="font-medium text-slate-300">Frontend:</span>{' '}
              <span className="text-cyan-400 font-semibold">Siya Giri</span>
            </p>
            <p className="pt-2 border-t border-white/5 mt-2">
              Stack: React, Express, MongoDB, and Socket.io.
            </p>
            <p className="text-xs opacity-75 mt-1">
              &copy; {new Date().getFullYear()} ClassVote. All rights reserved.
            </p>
          </div>
        </section>
      </div>
    </footer>
  );
};

export default Footer;