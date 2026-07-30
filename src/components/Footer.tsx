import type { FC } from 'react';
import { Terminal, ArrowUp, ShieldCheck } from 'lucide-react';

export const Footer: FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#060609] border-t border-red-500/25 py-12 relative text-slate-400 text-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
          
          {/* Brand & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/40 flex items-center justify-center text-red-500">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-white flex items-center gap-1.5">
                FS <span className="text-red-500">//</span> CYBER.RED
              </span>
              <span className="text-[11px] font-mono text-slate-500 block">
                Software Engineer • Backend Developer • Solution Architect
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-medium text-slate-300">
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
            className="p-3 rounded-xl bg-white/[0.04] border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all duration-300 glow-red-sm hover:glow-red"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Fetsu Siahaan. Built with Vite.js + React + TypeScript & Tailwind CSS v4.
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>ENTERPRISE GRADE ARCHITECTURE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
