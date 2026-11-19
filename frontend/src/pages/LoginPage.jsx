import { SignIn } from '@clerk/react';
import { usePageMeta } from '../utils/usePageMeta';

const LoginPage = () => {
  usePageMeta({
    title: 'Organizer Sign In',
    description: 'Sign in to your ClassVote organizer workspace with Google or Email OTP.',
    robots: 'index, follow'
  });

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="relative z-10 w-full flex justify-center">
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
};

export default LoginPage;
