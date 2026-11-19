import { SignIn } from '@clerk/react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { usePageMeta } from '../utils/usePageMeta';
import { clerkAppearance } from '../utils/clerkTheme';

const LoginPage = () => {
  usePageMeta({
    title: 'Organizer Sign In',
    description: 'Sign in to your ClassVote organizer workspace with Google or Email OTP.',
    robots: 'index, follow'
  });

  return (
    <div className="min-h-[82vh] flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[380px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[460px] mx-auto relative z-10 flex flex-col items-center"
      >
        {/* Subtle Brand Header above card */}
        <div className="text-center mb-6">
          <div className="badge-kicker mb-3 inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Organizer Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
            Sign in to ClassVote
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            Manage your election workspaces, rosters, and live counts.
          </p>
        </div>

        {/* Clean Clerk SignIn component */}
        <div className="w-full">
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/signup"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>

        {/* Security Trust Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
          <span>Encrypted session &bull; Zero spam &bull; Protected by Clerk</span>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
