import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Ghost, X, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

// Synthesize a fake email from a username so Firebase Email/Password auth works
// without requiring users to enter a real email address.
const toEmail = (username: string) =>
  `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@anonboard.local`;

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const email = toEmail(trimmed);

    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Auth state change in App.tsx will navigate to /dashboard automatically
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('That username is already taken. Try logging in instead.');
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('Username or password is incorrect.');
      } else if (code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Please enable it in your Firebase Console under Authentication → Sign-in method.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/20 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center">
              <Ghost className="w-5 h-5 text-accent" />
            </div>
            <span className="font-black text-xs uppercase tracking-widest text-accent">ANONBOARD</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-8">
            {(['signup', 'login'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                  mode === tab
                    ? 'bg-accent text-black'
                    : 'text-text-dim hover:text-white'
                }`}
              >
                {tab === 'signup' ? 'Create Board' : 'Log In'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-dim mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
                autoComplete="username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-all font-medium"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-dim mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs font-bold leading-relaxed bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20"
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-accent text-black rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] mt-2"
            >
              {loading ? 'PLEASE WAIT...' : (
                <>
                  {mode === 'signup' ? 'CREATE MY BOARD' : 'ACCESS MY BOARD'}
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-white/20 mt-6 leading-relaxed">
            No real email required. Your username becomes your anonymous board link.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
