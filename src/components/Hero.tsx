import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Shield, Zap, Server, Code, ArrowRight, Download, CheckCircle2, Activity, Database, Cloud } from 'lucide-react';

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
    <section className="relative min-h-screen pt-28 pb-16 md:pt-36 md:pb-24 flex items-center justify-center overflow-hidden bg-grid-pattern">
      {/* Radial Glow Background Effect */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/15 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Text (EXACT AS REQUESTED BY USER) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 flex flex-col items-start text-left space-y-6"
          >
            {/* Cyber Status Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-mono tracking-wide">
              <Terminal className="w-4 h-4 text-red-500 animate-pulse" />
              <span>ENTERPRISE ARCHITECTURE // MODERN WEB // REST API</span>
            </div>

            {/* Title & Subtitle EXACT MATCH */}
            <div className="space-y-3 w-full">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
                Halo, Saya <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-rose-300 text-glow-red">Fetsu Siahaan</span>
              </h1>
              
              <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-300 tracking-wide flex flex-wrap items-center gap-2 pt-1 border-l-4 border-red-600 pl-3.5">
                <span>Software Engineer</span>
                <span className="text-red-500">•</span>
                <span>Backend Developer</span>
                <span className="text-red-500">•</span>
                <span>Solution Architect</span>
              </div>
            </div>

            {/* Description EXACT MATCH */}
            <p className="text-base sm:text-lg md:text-xl text-slate-300/90 leading-relaxed max-w-2xl font-normal pt-2">
              Saya membantu mengembangkan aplikasi modern, REST API, dan sistem enterprise yang cepat, aman, dan scalable. Berpengalaman dalam membangun solusi berbasis web untuk meningkatkan efisiensi bisnis dan transformasi digital.
            </p>

            {/* Core Value Pillars Chips */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 w-full sm:w-auto">
              <a
                href="#projects"
                className="group px-7 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm sm:text-base uppercase tracking-wider transition-all duration-300 glow-red hover:glow-red-lg flex items-center justify-center gap-3 shadow-lg"
              >
                <span>Lihat Solusi & Proyek</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </a>

              <a
                href="#contact"
                className="px-7 py-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-red-500/40 hover:border-red-500 text-slate-200 hover:text-white font-bold text-sm sm:text-base uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5"
              >
                <span>Hubungi Saya</span>
              </a>

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
            <div className="relative rounded-2xl bg-[#0F0F16]/90 border border-red-500/30 p-5 sm:p-6 backdrop-blur-xl shadow-[0_0_50px_rgba(255,30,56,0.15)] overflow-hidden">
              {/* Terminal Window Bar */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-red-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 font-mono text-xs text-slate-400">telemetry://fetsu-enterprise-node:8080</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>LIVE NODE</span>
                </div>
              </div>

              {/* Real-time Simulated Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Throughput</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-white tracking-tight">{metrics.reqSec.toLocaleString()}</span>
                  <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">REQ / SEC</span>
                </div>
                
                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">API Latency</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-red-400 tracking-tight">{metrics.latency} ms</span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">P99 TARGET</span>
                </div>

                <div className="bg-white/[0.03] border border-slate-800/80 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">SLA Uptime</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400 tracking-tight">{metrics.uptime}%</span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">MULTI-REGION</span>
                </div>
              </div>

              {/* Interactive Architecture Flow Diagram Simulation */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-black/60 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Code className="w-4 h-4 text-red-500" />
                    <span className="text-slate-200 font-semibold">REST API & Microservices</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">OPTIMIZED // FAST</span>
                </div>

                <div className="p-3 rounded-lg bg-black/60 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-red-500" />
                    <span className="text-slate-200 font-semibold">Enterprise Security & WAF</span>
                  </div>
                  <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">AES-256-GCM ENCRYPTED</span>
                </div>

                <div className="p-3 rounded-lg bg-black/60 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-red-500" />
                    <span className="text-slate-200 font-semibold">High Availability Database</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">POSTGRESQL + REDIS CLUSTER</span>
                </div>

                <div className="p-3 rounded-lg bg-black/60 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Cloud className="w-4 h-4 text-red-500" />
                    <span className="text-slate-200 font-semibold">Auto-Scaling Cloud K8s</span>
                  </div>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">ELASTIC SCALING</span>
                </div>
              </div>

              {/* Bottom Quote / Tag */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
                  Ready for Digital Transformation
                </span>
                <span className="text-red-400">v2.6.0-PRO</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
