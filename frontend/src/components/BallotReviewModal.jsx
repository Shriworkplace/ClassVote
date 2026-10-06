import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle2, ArrowLeft, Send } from 'lucide-react';

const BallotReviewModal = ({ isOpen, onClose, onConfirm, positions, selectedCandidates, isSubmitting }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="glass-panel w-full max-w-lg p-6 sm:p-8 space-y-5 border border-white/[0.12] shadow-2xl relative"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-white tracking-tight">
                Review Your Ballot
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Verify your candidate selections before submitting.
              </p>
            </div>
          </div>

          {/* Choices Summary List */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {positions.map((pos) => {
              const selectedCandidateId = selectedCandidates[pos._id];
              const candidate = pos.candidates?.find(c => c._id === selectedCandidateId);

              return (
                <div
                  key={pos._id}
                  className="bg-slate-950/60 p-3.5 rounded-xl border border-white/[0.06] flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {pos.name}
                    </span>
                    <span className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      {candidate ? candidate.name : <span className="text-slate-500 italic">No Selection</span>}
                    </span>
                  </div>
                  {candidate?.photoUrl && (
                    <img
                      src={candidate.photoUrl}
                      alt={candidate.name}
                      className="w-9 h-9 rounded-lg object-cover border border-white/[0.1]"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Anonymity Notice */}
          <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              <strong className="text-cyan-300">100% Anonymous Secret Ballot:</strong> Your vote is strictly decoupled from your identity. No administrator or candidate can view which choices you selected.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Edit Choices
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="btn-primary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Casting Ballot...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirm & Cast Vote
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BallotReviewModal;
