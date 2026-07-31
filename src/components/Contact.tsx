import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Send, CheckCircle2, Mail, Cpu, ShieldCheck } from 'lucide-react';

export const Contact: FC = () => {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    projectType: 'REST API & Backend System',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormState({ name: '', email: '', projectType: 'REST API & Backend System', message: '' });
    }, 5000);
  };

  return (
    <section id="contact" className="py-20 md:py-28 bg-[#08080C] relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs tracking-wider uppercase">
            <Terminal className="w-3.5 h-3.5" />
            <span>Mulai Kolaborasi & Transformasi Digital</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Hubungi <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Fetsu Siahaan</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Siap untuk membangun aplikasi modern, REST API super cepat, atau arsitektur sistem enterprise yang aman? Kirimkan detail kebutuhan Anda atau jadwalkan sesi konsultasi teknis langsung.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          {/* Left Column: Contact Cards & Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-[#0F0F16] border border-red-500/30 p-6 sm:p-8 space-y-6 shadow-xl">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <Cpu className="w-6 h-6 text-red-500" />
                <span>Saluran Komunikasi Langsung</span>
              </h3>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Saya terbuka untuk diskusi konsultasi arsitektur (Solution Architecture), pengembangan REST API kelas enterprise, dan optimalisasi performa web aplikasi bisnis.
              </p>

              <div className="space-y-4 pt-2 font-mono text-sm">
                <a
                  href="mailto:fetsusiahaan.dev@gmail.com"
                  className="p-4 rounded-xl bg-white/[0.03] border border-slate-800 hover:border-red-500/60 flex items-center gap-4 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">EMAIL ENCRYPTED CHANNEL</span>
                    <span className="text-white font-semibold group-hover:text-red-400 transition-colors">fetsu.siahaan@architecture.dev</span>
                  </div>
                </a>

                <a
                  href="https://github.com/fetsusiahaan"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-xl bg-white/[0.03] border border-slate-800 hover:border-red-500/60 flex items-center gap-4 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">GITHUB ENTERPRISE REPOS</span>
                    <span className="text-white font-semibold group-hover:text-red-400 transition-colors">github.com/fetsusiahaan</span>
                  </div>
                </a>
              </div>

              {/* Security Guarantee Badge */}
              <div className="pt-4 border-t border-slate-800 flex items-center gap-2.5 text-xs font-mono text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>NDA & Enterprise Security Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Column: Terminal-Style Contact Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-[#0F0F16] border border-red-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Terminal Window Header */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 font-mono text-xs text-slate-400">bash: ./send_inquiry_to_fetsu.sh</span>
                </div>
                <span className="text-[11px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                  SECURE SSL CHANNEL
                </span>
              </div>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center space-y-4"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-2xl font-bold text-white">Pesan Telah Terkirim!</h4>
                  <p className="text-slate-300 max-w-md mx-auto text-sm">
                    Terima kasih telah menghubungi Fetsu Siahaan. Pesan Anda telah dienkripsi dan masuk ke antrean sistem. Saya akan segera merespons dalam waktu kurang dari 24 jam.
                  </p>
                  <div className="pt-4 font-mono text-xs text-red-400">
                    STATUS: [200 OK] INQUIRY_RECEIVED_SUCCESSFULLY
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block font-mono text-xs text-red-400 uppercase tracking-wider mb-2">
                        $ enter_client_name:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nama Anda atau Perusahaan"
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-slate-800 focus:border-red-500 text-white placeholder-slate-500 focus:outline-none transition-colors font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-red-400 uppercase tracking-wider mb-2">
                        $ enter_client_email:
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="email@company.com"
                        value={formState.email}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-slate-800 focus:border-red-500 text-white placeholder-slate-500 focus:outline-none transition-colors font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-red-400 uppercase tracking-wider mb-2">
                      $ select_project_type:
                    </label>
                    <select
                      value={formState.projectType}
                      onChange={(e) => setFormState({ ...formState, projectType: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-slate-800 focus:border-red-500 text-white focus:outline-none transition-colors font-mono text-sm"
                    >
                      <option className="bg-[#0F0F16]">REST API & Microservices Development</option>
                      <option className="bg-[#0F0F16]">Modern Web Application (React / Vite / Next.js)</option>
                      <option className="bg-[#0F0F16]">Cloud Solution Architecture & Scalability Consultation</option>
                      <option className="bg-[#0F0F16]">Enterprise Backend & Database Optimization</option>
                      <option className="bg-[#0F0F16]">Lainnya / Diskusi Kolaborasi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-red-400 uppercase tracking-wider mb-2">
                      $ enter_project_specifications:
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Tuliskan gambaran singkat kebutuhan sistem, target performa, atau tantangan bisnis yang dihadapi..."
                      value={formState.message}
                      onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-slate-800 focus:border-red-500 text-white placeholder-slate-500 focus:outline-none transition-colors font-mono text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm uppercase tracking-wider transition-all duration-300 glow-red hover:glow-red-lg flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                    <span>Kirim Pesan & Spesifikasi Teknis</span>
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
