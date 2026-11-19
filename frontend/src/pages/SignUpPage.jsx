import { SignUp } from '@clerk/react';
import { usePageMeta } from '../utils/usePageMeta';

const SignUpPage = () => {
  usePageMeta({
    title: 'Create Organizer Account',
    description: 'Create your free ClassVote organizer account to launch verified campus elections.',
    robots: 'index, follow'
  });

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="relative z-10 w-full flex justify-center">
        <SignUp
          path="/signup"
          routing="path"
          signInUrl="/login"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
};

export default SignUpPage;
