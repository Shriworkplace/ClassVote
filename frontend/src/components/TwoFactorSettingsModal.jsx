import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, Smartphone, Copy, Check,
  Download, KeyRound, Lock, X, Loader2, ArrowRight, RefreshCw, AlertTriangle
} from 'lucide-react';
import Alert from './Alert';

export default function TwoFactorSettingsModal({ isOpen, onClose, user, onStatusChange }) {
  // Modal Views: 'overview' | 'setup' | 'backup_codes_revealed' | 'disable' | 'regenerate'
  const [view, setView] = useState('overview');

  // Setup state
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUrl }
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackups, setCopiedBackups] = useState(false);

  // Disable / Regenerate state
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [statusInfo, setStatusInfo] = useState(null); // { twoFactorEnabled, backupCodesRemaining, backupCodesTotal }

  // Generic loading & error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch 2FA status when modal opens
  useEffect(() => {
    if (!isOpen) {
      setView('overview');
      setError('');
      setSuccess('');
      setVerifyCode('');
      setConfirmPassword('');
      setConfirmCode('');
      return;
    }

    const loadStatus = async () => {
      try {
        const res = await fetch('/api/auth/2fa/status');
        if (res.ok) {
          const data = await res.json();
          setStatusInfo(data);
        }
      } catch {
        // ignore
      }
    };
    loadStatus();
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Begin Setup Flow
  const handleStartSetup = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start 2FA setup');
      setSetupData(data);
      setView('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Confirm and Activate Setup
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    setError('');
    if (!verifyCode.trim()) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify-enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify code');

      setBackupCodes(data.backupCodes || []);
      setView('backup_codes_revealed');
      if (onStatusChange) onStatusChange(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: confirmPassword, code: confirmCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');

      setSuccess('Two-factor authentication has been disabled.');
      setView('overview');
      setStatusInfo(prev => ({ ...prev, twoFactorEnabled: false }));
      if (onStatusChange) onStatusChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Regenerate Backup Codes
  const handleRegenerateBackups = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/regenerate-backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: confirmPassword, code: confirmCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate backup codes');

      setBackupCodes(data.backupCodes || []);
      setView('backup_codes_revealed');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard?.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    if (!backupCodes.length) return;
    const text = `ClassVote Recovery Backup Codes (${user?.email || 'Organizer'})\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\nEach code can be used once if you lose access to your authenticator app.`;
    navigator.clipboard?.writeText(text);
    setCopiedBackups(true);
    setTimeout(() => setCopiedBackups(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes.length) return;
    const text = `ClassVote Recovery Backup Codes (${user?.email || 'Organizer'})\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\nEach code can be used once if you lose access to your authenticator app.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classvote-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const is2FAActive = statusInfo ? statusInfo.twoFactorEnabled : Boolean(user?.twoFactorEnabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-lg p-6 sm:p-8 space-y-5 border border-white/[0.12] my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-bold text-white">
                Two-Factor Authentication (2FA)
              </h3>
              <p className="text-xs text-slate-400">
                Protect your organizer workspace with Google Authenticator or Apple Passwords
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <Alert message={error} type="error" />}
        {success && <Alert message={success} type="success" />}

        {/* VIEW: OVERVIEW */}
        {view === 'overview' && (
          <div className="space-y-5">
            <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              is2FAActive
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-900/60 border-white/[0.08]'
            }`}>
              {is2FAActive ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-heading font-bold text-white">
                    {is2FAActive ? 'Two-Factor Authentication is Active' : '2FA is Currently Disabled'}
                  </h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    is2FAActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {is2FAActive ? 'PROTECTED' : 'NOT CONFIGURED'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {is2FAActive
                    ? 'Every sign-in to this organizer workspace requires both your password and a 6-digit code from your authenticator app.'
                    : 'Adding 2FA prevents unauthorized access to your election rosters, ballots, and results even if your password is leaked.'}
                </p>
                {is2FAActive && statusInfo && (
                  <p className="text-[11px] font-mono text-cyan-300 pt-1">
                    Backup codes remaining: <strong>{statusInfo.backupCodesRemaining}</strong> of {statusInfo.backupCodesTotal}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!is2FAActive ? (
              <button
                type="button"
                onClick={handleStartSetup}
                disabled={isLoading}
                className="btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                <span>Set Up Two-Factor Authentication</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('regenerate');
                    setError('');
                  }}
                  className="btn-secondary py-2.5 text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Regenerate Backup Codes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('disable');
                    setError('');
                  }}
                  className="btn-secondary py-2.5 text-xs text-rose-300 border-rose-500/30 hover:bg-rose-500/15 inline-flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Disable 2FA</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW: SETUP QR & VERIFICATION */}
        {view === 'setup' && setupData && (
          <div className="space-y-5">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Step 1 of 2</span>
              <h4 className="text-base font-heading font-bold text-white">
                Scan QR Code in Authenticator App
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Open Google Authenticator, Apple Passwords, Microsoft Authenticator, or Authy on your phone and scan this code:
              </p>
            </div>

            {/* QR Code & Manual Key */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-white/[0.08]">
              <div className="bg-white p-2.5 rounded-xl flex-shrink-0 shadow-md">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setupData.otpauthUrl)}`}
                  alt="2FA QR Code"
                  className="w-32 h-32"
                />
              </div>
              <div className="space-y-2 text-left w-full min-w-0">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Can't scan? Enter key manually:
                </span>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-white/[0.08] font-mono text-xs text-cyan-300 break-all select-all">
                  {setupData.secret}
                </div>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-mono"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSecret ? 'Secret Copied!' : 'Copy Key'}</span>
                </button>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleVerifySetup} className="space-y-4 pt-2 border-t border-white/[0.08]">
              <div>
                <label className="block text-xs font-heading font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={8}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000 000"
                  className="glass-input text-center font-mono text-xl tracking-[0.25em] font-bold"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView('overview')}
                  className="btn-secondary flex-1 py-2.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Activate 2FA</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: BACKUP CODES REVEALED (SUCCESS) */}
        {view === 'backup_codes_revealed' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl mx-auto flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-heading font-bold text-white">
                Save Your Recovery Backup Codes
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                If you ever lose access to your phone or authenticator app, each of these 8 codes can be used <strong>once</strong> to sign in.
              </p>
            </div>

            {/* Codes Grid */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-4 rounded-2xl border border-white/[0.12] font-mono text-xs text-center">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="bg-slate-900/90 py-1.5 px-3 rounded-lg border border-white/[0.06] text-cyan-300 select-all font-semibold">
                  {code}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyBackupCodes}
                className="btn-secondary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-1.5"
              >
                {copiedBackups ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBackups ? 'Copied All!' : 'Copy Codes'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadBackupCodes}
                className="btn-secondary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download .txt</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setView('overview')}
              className="btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <span>I Have Safely Stored My Backup Codes</span>
            </button>
          </div>
        )}

        {/* VIEW: DISABLE 2FA */}
        {view === 'disable' && (
          <form onSubmit={handleDisable2FA} className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Disable Two-Factor Authentication
              </h4>
              <p className="text-xs text-slate-300">
                To confirm disabling 2FA, please enter your current account password and a 6-digit authenticator code.
              </p>
            </div>

            <div>
              <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">
                Account Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Current password"
                className="glass-input"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">
                6-Digit Authenticator Code (or Backup Code)
              </label>
              <input
                type="text"
                required
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="000 000"
                className="glass-input font-mono"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setView('overview')}
                className="btn-secondary flex-1 py-2.5 text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-secondary flex-1 py-2.5 text-xs text-rose-300 border-rose-500/40 hover:bg-rose-500/20 inline-flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
                <span>Confirm Disable 2FA</span>
              </button>
            </div>
          </form>
        )}

        {/* VIEW: REGENERATE BACKUP CODES */}
        {view === 'regenerate' && (
          <form onSubmit={handleRegenerateBackups} className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                Regenerate Backup Codes
              </h4>
              <p className="text-xs text-slate-300">
                Generating new backup recovery codes will immediately invalidate all previously issued backup codes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">
                Account Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Current password"
                className="glass-input"
              />
            </div>

            <div>
              <label className="block text-xs font-heading font-semibold uppercase text-slate-300 mb-1">
                6-Digit Authenticator Code
              </label>
              <input
                type="text"
                required
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="000 000"
                className="glass-input font-mono"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setView('overview')}
                className="btn-secondary flex-1 py-2.5 text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex-1 py-2.5 text-xs inline-flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Generate New Codes</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
