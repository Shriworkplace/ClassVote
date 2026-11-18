import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Vote, Radio, ExternalLink, ShieldCheck, Users, Loader2 } from 'lucide-react';

const ElectionEmbedWidget = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const res = await fetch(`/api/e/${encodeURIComponent(slug)}/summary`);
        const json = await res.json();
        if (!cancelled) {
          if (res.ok) {
            setData(json);
          } else {
            setError(json.error || 'Election not found');
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load election widget');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 15000); // 15s live refresh
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  const publicVoteUrl = `${window.location.origin}/e/${encodeURIComponent(slug)}`;

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
        <span className="text-xs font-mono">Loading live ballot tracker...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full min-h-[180px] flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-400 text-center">
        <p className="text-xs font-mono text-rose-400 mb-1">{error || 'Election not found'}</p>
        <a
          href={window.location.origin}
          target="_blank"
          rel="noopener"
          className="text-[11px] text-cyan-400 hover:underline"
        >
          Visit ClassVote &rarr;
        </a>
      </div>
    );
  }

  const { election, totalVotes, totalCandidates, totalPositions } = data;
  const isLive = election?.isCurrentlyOpen;

  return (
    <div className="w-full bg-slate-950/95 border border-white/10 rounded-2xl p-4 text-white shadow-2xl font-sans overflow-hidden">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-heading font-black text-white truncate tracking-tight">
              {election.title}
            </h2>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold inline-flex items-center gap-1 flex-shrink-0 ${
                isLive
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-white/10'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {isLive ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
          {election.organization && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{election.organization}</p>
          )}
        </div>

        <a
          href={publicVoteUrl}
          target="_blank"
          rel="noopener"
          className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1 flex-shrink-0 shadow-sm"
        >
          <Vote className="w-3.5 h-3.5" />
          <span>{isLive ? 'Vote Now' : 'View'}</span>
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-900/60 rounded-xl border border-white/[0.06] mb-3 text-center">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Turnout</span>
          <span className="text-sm sm:text-base font-mono font-black text-cyan-300 tabular-nums">
            {totalVotes || 0}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Offices</span>
          <span className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
            {totalPositions || 0}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">Candidates</span>
          <span className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
            {totalCandidates || 0}
          </span>
        </div>
      </div>

      {/* Footer Backlink Attribution */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/[0.06]">
        <div className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted Ballot</span>
        </div>
        <div>
          <span>Powered by </span>
          <a
            href={window.location.origin}
            target="_blank"
            rel="noopener"
            className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline"
          >
            ClassVote
          </a>
        </div>
      </div>
    </div>
  );
};

export default ElectionEmbedWidget;
