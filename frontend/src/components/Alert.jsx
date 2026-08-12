import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Alert = ({ message, type = 'error', onClose }) => {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`mb-6 p-4 rounded-xl backdrop-blur-md border flex items-center gap-3 ${
          isError 
            ? 'bg-red-500/10 border-red-500/20 text-red-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}
      >
        {isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        <p className="font-medium">{message}</p>
      </motion.div>
    </AnimatePresence>
  );
};

export default Alert;
