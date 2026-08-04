import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Shield, Zap, Server, Code, ArrowRight, Download, CheckCircle2, Activity, Database, Cloud } from 'lucide-react';

const ARCHITECTURE_ROWS = [
  {
    icon: Code,
    label: 'REST API & Microservices',
    badge: 'OPTIMIZED // FAST',
    tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    icon: Shield,
    label: 'Enterprise Security & WAF',
    badge: 'AES-256-GCM ENCRYPTED',
    tone: 'text-red-400 bg-red-500/10 border-red-500/30',
  },
  {
    icon: Database,
    label: 'High Availability Database',
    badge: 'POSTGRESQL + REDIS CLUSTER',
    tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    icon: Cloud,
    label: 'Auto-Scaling Cloud K8s',
    badge: 'ELASTIC SCALING',
    tone: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
];

export const Hero: FC = () => {
  const [metrics, setMetrics] = useState({
    reqSec: 14280,
    latency: 11.4,
    uptime: 99.998,
  });

  // Simulated live telemetry pulses
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        reqSec: Math.floor(14000 + Math.random() * 800),
        latency: parseFloat((10.8 + Math.random() * 1.5).toFixed(1)),
        uptime: 99.998,
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen pt-24 pb-14 sm:pt-28 sm:pb-16 md:pt-36 md:pb-24 flex items-center justify-center overflow-hidden bg-grid-pattern scroll-mt-24">
      {/* Radial Glow Background Effect */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/15 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Text (EXACT AS REQUESTED BY USER) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 flex flex-col items-start text-left space-y-5 sm:space-y-6"
          >
            {/* Cyber Status Badge — the full triple label wraps to three lines on a
                phone, so the narrow viewport gets an abridged version. */}
            <div className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] sm:text-sm font-mono tracking-wide">
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 animate-pulse flex-shrink-0" />
              <span className="hidden sm:inline">ENTERPRISE ARCHITECTURE // MODERN WEB // REST API</span>
              <span className="sm:hidden">ENTERPRISE ARCH // REST API</span>
            </div>

            {/* Title & Subtitle EXACT MATCH */}
            <div className="space-y-3 w-full">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
                Halo, Saya <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-rose-300 text-glow-red">Fetsu Siahaan</span>
              </h1>
              
              {/* One role per line on a phone: wrapping them mid-list left orphan
                  words and stranded bullets. */}
              <div className="text-base sm:text-xl md:text-2xl font-bold font-mono text-slate-300 tracking-wide flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-0.5 sm:gap-2 pt-1 border-l-4 border-red-600 pl-3 sm:pl-3.5">
                <span>Software Engineer</span>
                <span className="hidden sm:inline text-red-500">•</span>
                <span>Backend Developer</span>
                <span className="hidden sm:inline text-red-500">•</span>
                <span>Solution Architect</span>
              </div>
            </div>

            {/* Description EXACT MATCH */}
            <p className="text-[15px] sm:text-lg md:text-xl text-slate-300/90 leading-relaxed max-w-2xl font-normal pt-1 sm:pt-2">
              Saya membantu mengembangkan aplikasi modern, REST API, dan sistem enterprise yang cepat, aman, dan scalable. Berpengalaman dalam membangun solusi berbasis web untuk meningkatkan efisiensi bisnis dan transformasi digital.
            </p>

            {/* Core Value Pillars Chips */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-red-500/20 text-xs font-semibold text-slate-200">
                <Zap className="w-3.5 h-3.5 text-red-400" />
                <span>Super Cepat (High Performance)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-red-500/20 text-xs font-semibold text-slate-200">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>Enterprise Security (Sangat Aman)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-red-500/20 text-xs font-semibold text-slate-200">
                <Server className="w-3.5 h-3.5 text-red-400" />
                <span>Scalable Cloud Native</span>
              </div>
            </div>

            {/* Interactive Call to Action Buttons */}
            {/* Three stacked full-width buttons ate most of a phone screen. The two
                primary actions now sit side by side; the CV link stays below. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 pt-3 sm:pt-4 w-full sm:w-auto">
              <div className="flex items-stretch gap-3 sm:contents">
                <a
                  href="#projects"
                  className="group flex-1 px-4 sm:px-7 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold text-[13px] sm:text-base uppercase tracking-wider transition-all duration-300 glow-red hover:glow-red-lg flex items-center justify-center gap-2 sm:gap-3 shadow-lg active:scale-[0.98]"
                >
                  <span>Lihat <span className="hidden sm:inline">Solusi & </span>Proyek</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1.5 transition-transform" />
                </a>

                <a
                  href="#contact"
                  className="flex-1 px-4 sm:px-7 py-3.5 sm:py-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-red-500/40 hover:border-red-500 text-slate-200 hover:text-white font-bold text-[13px] sm:text-base uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98]"
                >
                  <span>Hubungi<span className="hidden sm:inline"> Saya</span></span>
                </a>
              </div>

              <a
                href="#contact"
                className="sm:hidden px-7 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 font-mono text-xs flex items-center justify-center gap-2 hover:border-red-500/50 transition-colors"
              >
                <Download className="w-4 h-4 text-red-400" />
                <span>Unduh CV / Portfolio PDF</span>
              </a>
            </div>
          </motion.div>

          {/* Right Column: Cyber Telemetry & Live System Architecture Visualizer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5 w-full"
          >
            <div className="relative rounded-2xl bg-[#0F0F16]/90 border border-red-500/30 p-4 sm:p-6 backdrop-blur-xl shadow-[0_0_50px_rgba(255,30,56,0.15)] overflow-hidden">
              {/* Terminal Window Bar — the host URL is truncated rather than allowed
                  to shove the LIVE badge off the panel. */}
              <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 sm:pb-4 sm:mb-5 border-b border-red-500/20">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="ml-1 sm:ml-2 font-mono text-[10px] sm:text-xs text-slate-400 truncate">telemetry://fetsu-enterprise-node:8080</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 flex-shrink-0">
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>LIVE</span>
                  <span className="hidden sm:inline">NODE</span>
                </div>
              </div>

              {/* Real-time Simulated Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase block mb-1">Throughput</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-white tracking-tight">{metrics.reqSec.toLocaleString()}</span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 block mt-0.5">REQ / SEC</span>
                </div>

                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase block mb-1">Latency</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-red-400 tracking-tight">{metrics.latency} ms</span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 block mt-0.5">P99 TARGET</span>
                </div>

                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase block mb-1">Uptime</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-emerald-400 tracking-tight">{metrics.uptime}%</span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 block mt-0.5">MULTI-REGION</span>
                </div>
              </div>

              {/* Interactive Architecture Flow Diagram Simulation */}
              {/* Label and badge share a row only from sm up. Below that the badge
                  drops under the label — side by side, the longest pair
                  (POSTGRESQL + REDIS CLUSTER) broke across three lines. */}
              <div className="space-y-2.5 sm:space-y-3 font-mono text-xs">
                {ARCHITECTURE_ROWS.map(row => (
                  <div
                    key={row.label}
                    className="p-2.5 sm:p-3 rounded-lg bg-black/60 border border-red-500/20 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <row.icon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-slate-200 font-semibold text-[11px] sm:text-xs">{row.label}</span>
                    </div>
                    <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded border ml-6 sm:ml-0 flex-shrink-0 ${row.tone}`}>
                      {row.badge}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Quote / Tag */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 text-slate-400 text-[10px] sm:text-[11px] font-mono">
                <span className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="truncate">Ready for Digital Transformation</span>
                </span>
                <span className="text-red-400 flex-shrink-0">v2.6.0-PRO</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
