import { dark } from '@clerk/themes';

export const clerkAppearance = {
  baseTheme: dark,
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false
  },
  variables: {
    colorPrimary: '#06b6d4', // Cyan 500
    colorBackground: '#0b1329', // ClassVote slate dark
    colorInputBackground: '#060d1f', // Deep dark input
    colorInputText: '#f8fafc',
    colorText: '#f8fafc',
    colorTextSecondary: '#94a3b8',
    borderRadius: '14px',
    fontFamily: 'Plus Jakarta Sans, sans-serif'
  },
  elements: {
    rootBox: 'w-full max-w-[440px] mx-auto',
    cardBox: 'w-full shadow-none',
    card: 'bg-slate-900/85 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-[0_16px_48px_rgba(0,0,0,0.5)] transition-all',
    headerTitle: 'font-heading font-black text-white text-2xl tracking-tight',
    headerSubtitle: 'text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed',
    socialButtonsBlockButton: 'bg-slate-950/80 hover:bg-slate-800/90 border border-white/[0.12] hover:border-cyan-400/50 text-white rounded-xl py-3 transition-all duration-200 text-sm font-semibold shadow-sm hover:-translate-y-0.5 active:translate-y-0',
    socialButtonsBlockButtonText: 'font-sans text-sm font-medium text-slate-200',
    dividerLine: 'bg-white/[0.08]',
    dividerText: 'text-xs font-mono uppercase tracking-wider text-slate-400 bg-transparent px-3',
    formFieldLabel: 'text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5',
    formFieldInput: 'bg-slate-950/90 border border-white/[0.12] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25 text-white rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 transition-all duration-200 font-sans',
    formButtonPrimary: 'w-full py-3.5 px-6 rounded-xl font-heading font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-600 shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_32px_rgba(6,182,212,0.55)] hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0',
    footerActionText: 'text-xs text-slate-400',
    footerActionLink: 'text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline-offset-4 hover:underline ml-1',
    footer: 'bg-transparent pt-4 border-t border-white/[0.06]',
    identityPreview: 'bg-slate-950/80 border border-white/[0.08] rounded-xl p-3',
    identityPreviewText: 'text-xs font-mono text-cyan-300',
    identityPreviewEditButton: 'text-xs text-cyan-400 hover:text-cyan-300 font-semibold',
    formFieldAction: 'text-xs text-cyan-400 hover:text-cyan-300 font-medium',
    formResendCodeLink: 'text-xs text-cyan-400 hover:text-cyan-300 font-semibold',
    otpCodeFieldInput: 'bg-slate-950/90 border border-white/[0.12] text-cyan-300 text-2xl font-mono font-bold rounded-xl'
  }
};
