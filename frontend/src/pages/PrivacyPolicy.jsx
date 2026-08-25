import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="max-w-3xl mx-auto pb-24 px-4">
      {/* Back button */}
      <div className="mb-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-wider text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
      </div>

      <div className="glass-panel p-8 sm:p-12 space-y-10">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="badge-kicker mb-3 inline-flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Compliance & Data Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight">
            Voter Data Privacy Notice
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-sans">
            How voter identity, authentication records, and ballot selections are handled securely.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400">01.</span>
            <h2 className="text-lg font-heading font-bold text-white tracking-tight">Data Collected</h2>
          </div>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans pl-6">
            ClassVote collects the full name and institutional email address submitted on the authentication page, 
            cross-references eligible voter roster records, and records the submitted candidate selections for each office.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400">02.</span>
            <h2 className="text-lg font-heading font-bold text-white tracking-tight">Purpose & Usage</h2>
          </div>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans pl-6">
            Collected data is strictly used to confirm eligibility on the official roster, enforce single-ballot constraints,
            compile election results, and display certified tallies once results are officially declared.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400">03.</span>
            <h2 className="text-lg font-heading font-bold text-white tracking-tight">Storage & Retention</h2>
          </div>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans pl-6">
            Election records are encrypted in transit and stored within a secured database for the duration of the 
            election and subsequent audit period. Administrative secrets are stored securely in environment variables.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400">04.</span>
            <h2 className="text-lg font-heading font-bold text-white tracking-tight">Access Control & Security</h2>
          </div>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-sans pl-6">
            Administrative endpoints require cryptographic authorization. Rate limiting, origin verification, and 
            isolated sessions safeguard the system against automated abuse.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;