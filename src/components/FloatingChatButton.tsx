import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Zap, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FloatingChatButton: FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show tooltip after 3s
  useEffect(() => {
    const t = setTimeout(() => {
      if (!dismissed) setShowTooltip(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [dismissed]);

  // Hide tooltip after 6s
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(() => setShowTooltip(false), 6000);
    return () => clearTimeout(t);
  }, [showTooltip]);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
      {/* Tooltip Bubble */}
      <AnimatePresence>
        {showTooltip && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-[#0F0F16] border border-red-500/30 rounded-2xl p-3 pr-8 shadow-2xl shadow-black/50 max-w-[180px] sm:max-w-[200px]"
          >
            {/* Dismiss */}
            <button
              onClick={() => { setShowTooltip(false); setDismissed(true); }}
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Arrow */}
            <div className="absolute bottom-[-7px] right-4 sm:right-5 w-3 h-3 bg-[#0F0F16] border-r border-b border-red-500/30 rotate-45" />

            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-xs font-semibold leading-tight">Tanya FetsuBot!</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  AI assistant untuk menjawab pertanyaan tentang Fetsu
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <Link to="/chat">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onHoverStart={() => setShowTooltip(true)}
          onHoverEnd={() => !dismissed && setShowTooltip(false)}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-600 to-red-500 text-white shadow-2xl shadow-red-900/50 flex items-center justify-center group overflow-hidden"
          aria-label="Open AI Chatbot"
        >
          {/* Glow ring */}
          <span className="absolute inset-0 rounded-xl sm:rounded-2xl ring-2 ring-red-500/40 group-hover:ring-red-400/60 transition-all duration-300" />
          {/* Pulse */}
          <span className="absolute inset-0 rounded-xl sm:rounded-2xl bg-red-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />

          {/* Icon toggle */}
          <Bot className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />

          {/* Badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#08080C] flex items-center justify-center">
            <MessageCircle className="w-2 h-2 text-white" />
          </span>
        </motion.button>
      </Link>
    </div>
  );
};
