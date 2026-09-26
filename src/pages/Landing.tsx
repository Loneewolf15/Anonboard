import React, { useState } from 'react';
import { motion } from 'motion/react';
import AuthModal from '../components/AuthModal';

export default function Landing() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-32 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 sm:space-y-12"
      >
        <h1 className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] mb-8">
          DROP AN<br />
          <span className="text-accent italic">ANONYMOUS</span><br />
          MESSAGE.
        </h1>
        
        <p className="text-text-dim text-base sm:text-lg md:text-xl max-w-xl mx-auto leading-relaxed font-medium uppercase tracking-tight">
          The boldest way to get raw feedback and anonymous confessions. Zero traces, total mystery.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 sm:pt-10">
          <button 
            onClick={() => setShowAuth(true)}
            className="w-full sm:w-auto px-10 py-5 bg-accent text-black rounded-xl font-black text-lg sm:text-xl transition-all active:scale-95 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] uppercase italic tracking-tighter"
          >
            START YOUR BOARD
          </button>
          <button
            onClick={() => setShowAuth(true)}
            className="w-full sm:w-auto px-10 py-5 bg-transparent border border-white/10 text-text-dim rounded-xl font-black text-lg sm:text-xl transition-all active:scale-95 hover:border-white/30 hover:text-white uppercase italic tracking-tighter"
          >
            LOG IN
          </button>
        </div>
      </motion.div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
