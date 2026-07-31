import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

interface LoadingScreenProps {
  onComplete?: () => void;
  durationMs?: number;
}

export const LoadingScreen: FC<LoadingScreenProps> = ({ onComplete, durationMs = 2000 }) => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress counter animation up to 100%
    const intervalTime = 30;
    const steps = durationMs / intervalTime;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + increment);
      });
    }, intervalTime);

    // Hide screen after duration
    const hideTimer = setTimeout(() => {
      setLoading(false);
      if (onComplete) onComplete();
    }, durationMs);

    return () => {
      clearInterval(timer);
      clearTimeout(hideTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] bg-[#08080C] flex flex-col items-center justify-center select-none overflow-hidden"
        >
          {/* Background Radial Glow */}
          <div className="absolute w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center gap-6 max-w-xs text-center px-4">
            
            {/* Logo Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/40 flex items-center justify-center text-red-500 glow-red shadow-2xl shadow-red-950/60"
            >
              <Terminal className="w-7 h-7" />
            </motion.div>

            {/* Brand Title */}
            <div>
              <h1 className="text-2xl font-extrabold tracking-wider text-white flex items-center justify-center gap-1">
                Fetsu<span className="text-red-500">.</span> ID
              </h1>
              <p className="text-[11px] font-mono text-slate-400 tracking-widest uppercase mt-1">
                Enterprise Architecture System
              </p>
            </div>

            {/* Bouncing Balls Animation (Animasi Bola Melompat) */}
            <div className="flex items-center gap-3 py-2">
              {[0, 0.18, 0.36].map((delay, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    y: [0, -18, 0],
                    scale: [1, 1.2, 1],
                    boxShadow: [
                      '0 0 10px rgba(239, 68, 68, 0.4)',
                      '0 0 25px rgba(239, 68, 68, 0.9)',
                      '0 0 10px rgba(239, 68, 68, 0.4)',
                    ],
                  }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay,
                  }}
                  className={`rounded-full bg-gradient-to-tr from-red-600 to-rose-400 ${
                    idx === 1 ? 'w-4 h-4' : 'w-3.5 h-3.5 opacity-85'
                  }`}
                />
              ))}
            </div>

            {/* Progress Bar & Percentage */}
            <div className="w-full space-y-2">
              <div className="h-1.5 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden p-0.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-400 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>SYS_INIT...</span>
                <span className="text-red-400 font-bold">{Math.round(progress)}%</span>
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
