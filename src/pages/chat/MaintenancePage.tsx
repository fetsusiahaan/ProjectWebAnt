import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Wrench, ArrowLeft, Settings, Server, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';

/** Parses "YYYY-MM-DD HH:mm" as local time — bare space-separated strings are not ISO and parse inconsistently across engines. */
function parseLocal(datetime: string): number {
  const [datePart, timePart] = datetime.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

function formatCountdown(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const UNITS = [
  { key: 'd', label: 'Hari' },
  { key: 'h', label: 'Jam' },
  { key: 'm', label: 'Menit' },
  { key: 's', label: 'Detik' },
] as const;

export const MaintenancePage: FC<{ until: string }> = ({ until }) => {
  const target = parseLocal(until);
  const [timeLeft, setTimeLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = setInterval(() => setTimeLeft(target - Date.now()), 1000);
    return () => clearInterval(tick);
  }, [target]);

  const parts = formatCountdown(timeLeft);
  const done = timeLeft <= 0;

  return (
    <div
      className="h-[100dvh] flex flex-col items-center justify-center gap-3 sm:gap-6 px-4 sm:px-6 py-4 text-center relative overflow-hidden bg-[#08080C] bg-grid-pattern"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      <SEOHead
        title="Maintenance — FetsuBot"
        description="FetsuBot sedang dalam perbaikan sistem. Silakan kembali lagi nanti."
        canonicalUrl="https://fetsu.id/chat"
        indexable={false}
      />

      {/* Same radial glow as Home's hero */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none" />

      {/* Kicker */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-red-500/30 bg-red-600/15 text-red-400 text-[9px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.2em] uppercase text-center"
      >
        <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
        Lagi Dibenerin, Bentar Ya
      </motion.div>

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="relative max-w-lg px-2"
      >
        <h1 className="text-white text-lg sm:text-4xl font-bold tracking-tight leading-snug sm:leading-tight">
          Waduh, FetsuBot<br />Lagi Ngopi Dulu ☕
        </h1>
        <p className="text-slate-500 text-[10px] sm:text-sm mt-1.5 sm:mt-4 tracking-wide leading-relaxed max-w-[260px] sm:max-w-sm mx-auto">
          Tenang, bukan ngambek — cuma lagi diupgrade biar makin ngebut dan makin pinter. Balik lagi setelah countdown ini abis, ya!
        </p>
      </motion.div>

      {/* Icon strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="relative flex items-center gap-2 sm:gap-4"
      >
        {[Server, Settings, HardDrive].map((Icon, i) => (
          <div
            key={i}
            className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-red-600/15 border border-red-500/25 flex items-center justify-center"
          >
            {Icon === Settings ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
                <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400/70" />
              </motion.div>
            ) : (
              <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400/70" />
            )}
          </div>
        ))}
      </motion.div>

      {/* Countdown grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative"
      >
        {!done ? (
          <div className="flex items-stretch gap-1.5 sm:gap-3">
            {UNITS.map((u) => (
              <div
                key={u.key}
                className="flex flex-col items-center gap-1 sm:gap-2 w-[52px] sm:w-[84px] px-2 sm:px-4 py-2 sm:py-5 rounded-lg sm:rounded-xl bg-white/[0.03] border border-red-500/25 backdrop-blur-sm"
              >
                <span className="text-white text-base sm:text-4xl font-bold tabular-nums tracking-tight">
                  {String(parts[u.key]).padStart(2, '0')}
                </span>
                <span className="text-[7px] sm:text-[10px] text-red-400/60 tracking-[0.1em] sm:tracking-[0.15em] uppercase">
                  {u.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-emerald-400 text-sm tracking-wide">
            Udah kelar tuh! Refresh halaman ini, gaskeun. 🚀
          </p>
        )}
      </motion.div>

      {/* Back link */}
      <Link
        to="/"
        className="relative flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white text-[9px] sm:text-[11px] font-bold tracking-[0.1em] uppercase shadow-lg glow-red transition-all active:scale-95"
      >
        <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        Kembali ke Beranda
      </Link>
    </div>
  );
};
