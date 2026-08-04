import type { FC } from 'react';
import { Terminal, ArrowUp, ShieldCheck } from 'lucide-react';

export const Footer: FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#060609] border-t border-red-500/25 py-10 sm:py-12 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pb-12 relative text-slate-400 text-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 pb-6 sm:pb-8 border-b border-slate-800/80">

          {/* Brand shares its row with the back-to-top button on a phone — stacked,
              the button ended up marooned under the wrapped link list. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/40 flex items-center justify-center text-red-500 flex-shrink-0">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold tracking-wider text-white flex items-center gap-1.5">
                  FS <span className="text-red-500">//</span> CYBER.RED
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 block">
                  Software Engineer • Backend Developer<span className="hidden sm:inline"> • Solution Architect</span>
                </span>
              </div>
            </div>

            <button
              onClick={scrollToTop}
              aria-label="Kembali ke atas"
              className="md:hidden p-2.5 rounded-xl bg-white/[0.04] border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all duration-300 glow-red-sm active:scale-95 flex-shrink-0"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] sm:text-sm font-medium text-slate-300">
            <a href="#about" className="hover:text-red-400 transition-colors">Tentang</a>
            <a href="#skills" className="hover:text-red-400 transition-colors">Keahlian</a>
            <a href="#architecture" className="hover:text-red-400 transition-colors">Arsitektur</a>
            <a href="#projects" className="hover:text-red-400 transition-colors">Solusi Enterprise</a>
            <a href="#contact" className="hover:text-red-400 transition-colors">Kontak</a>
          </div>

          {/* Back to top button */}
          <button
            onClick={scrollToTop}
            aria-label="Kembali ke atas"
            className="hidden md:block p-3 rounded-xl bg-white/[0.04] border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all duration-300 glow-red-sm hover:glow-red"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[10px] sm:text-xs font-mono text-slate-500 text-center sm:text-left">
          <div>
            &copy; {new Date().getFullYear()} Fetsu Siahaan. Built with Vite.js + React + TypeScript & Tailwind CSS v4.
          </div>
          <div className="flex items-center gap-2 text-emerald-400 flex-shrink-0">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>ENTERPRISE GRADE ARCHITECTURE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
