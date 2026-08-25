import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Alert = ({ message, type = 'error', onClose }) => {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`mb-6 p-4 rounded-xl backdrop-blur-md border flex items-center gap-3 shadow-lg ${
          isError 
            ? 'bg-red-500/10 border-red-500/25 text-red-300' 
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
        }`}
      >
        {isError ? <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />}
        <p className="font-sans font-medium text-sm leading-snug">{message}</p>
      </motion.div>
    </AnimatePresence>
  );
};

export default Alert;
