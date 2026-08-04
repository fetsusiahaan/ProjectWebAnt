import { useState, useEffect } from 'react';
import type { FC, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldCheck, Menu, X, Cpu, ArrowUpRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export const Navbar: FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Tentang', href: '#about' },
    { name: 'Keahlian', href: '#skills' },
    { name: 'Arsitektur', href: '#architecture' },
    { name: 'Proyek & Solusi', href: '#projects' },
    { name: 'Kontak', href: '#contact' },
  ];

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    const targetId = href.replace('#', '');

    if (location.pathname !== '/' && location.pathname !== '') {
      navigate('/' + href);
      return;
    }

    if (!targetId) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 160);
      return;
    }

    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = Math.max(0, elementPosition - headerOffset);

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }, 160);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-[env(safe-area-inset-top)] ${isScrolled
        ? 'bg-[#08080C]/90 backdrop-blur-md border-b border-red-500/25 shadow-[0_4px_30px_rgba(0,0,0,0.8)] py-3'
        : 'bg-gradient-to-b from-[#08080C]/80 via-[#08080C]/40 to-transparent backdrop-blur-sm py-3.5 md:py-6'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Logo */}
        <a href="#" onClick={(e) => handleNavClick(e, '#')} className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-red-600/10 border border-red-500/40 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-300 group-hover:glow-red flex-shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold tracking-wider text-base sm:text-lg text-white group-hover:text-red-400 transition-colors flex items-center gap-1.5">
              FetsuS<span className="text-red-500">.</span>ID
            </span>
            {/* Full byline only where it fits — on a phone it wrapped to two lines
                and pushed the bar taller than the logo. */}
            <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase truncate">
              <span className="hidden min-[400px]:inline">Fetsu Siahaan • </span>Enterprise Arch
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Right Status Indicator & CTA */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute" />
            <span>SYS_ONLINE: 99.99%</span>
          </div>

          <a
            href="#contact"
            onClick={(e) => handleNavClick(e, '#contact')}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 glow-red-sm hover:glow-red flex items-center gap-1.5"
          >
            <span>Konsultasi Proyek</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Menu"
          className="md:hidden p-2.5 rounded-lg bg-slate-900/80 border border-red-500/30 text-slate-300 hover:text-red-400 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="md:hidden border-b border-red-500/30 bg-[#08080C]/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between py-2 border-b border-slate-800 text-xs font-mono text-emerald-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM STATUS: OPTIMAL (99.99%)
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex flex-col gap-1 pt-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-4 py-3 rounded-lg text-base font-medium text-slate-200 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-between"
                >
                  <span>{link.name}</span>
                  <span className="font-mono text-xs text-red-500/60">// 0{navLinks.indexOf(link) + 1}</span>
                </a>
              ))}
            </div>

            <div className="pt-3">
              <a
                href="#contact"
                onClick={(e) => handleNavClick(e, '#contact')}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold text-sm uppercase tracking-wider text-center flex items-center justify-center gap-2 glow-red-sm"
              >
                <Cpu className="w-4 h-4" />
                <span>Konsultasi Proyek</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
