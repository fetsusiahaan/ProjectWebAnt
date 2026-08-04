import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Layers, CheckCircle, Cpu, Lock } from 'lucide-react';

export const About: FC = () => {
  const pillars = [
    {
      icon: <Zap className="w-7 h-7 text-red-500" />,
      title: "Cepat & Responsif (High Speed)",
      description: "Pengembangan arsitektur backend dan REST API dengan waktu respons ultra-rendah (sub-15ms). Optimasi database query, strategi caching multi-layer dengan Redis, serta eksekusi asinkron berkinerja tinggi untuk melayani jutaan request per detik.",
      metric: "< 15 ms",
      metricLabel: "Rata-rata Latensi API"
    },
    {
      icon: <Lock className="w-7 h-7 text-red-500" />,
      title: "Sangat Aman (Enterprise Security)",
      description: "Penerapan standar keamanan kelas enterprise (Zero Trust Architecture, Role-Based Access Control, enkripsi data in-transit & at-rest AES-256, serta proteksi terhadap ancaman OWASP Top 10) demi menjaga kerahasiaan dan integritas data bisnis.",
      metric: "100% Secure",
      metricLabel: "Standar Enkripsi & Proteksi"
    },
    {
      icon: <Layers className="w-7 h-7 text-red-500" />,
      title: "Scalable & Cloud Native",
      description: "Solusi berbasis microservices dan event-driven architecture menggunakan Docker dan Kubernetes. Sistem dirancang elastis dan mampu beradaptasi secara otomatis saat lonjakan trafik masif tanpa mengorbankan stabilitas.",
      metric: "99.99%",
      metricLabel: "Target SLA Availability"
    },
    {
      icon: <TrendingUp className="w-7 h-7 text-red-500" />,
      title: "Efisiensi & Transformasi Digital",
      description: "Mengubah proses bisnis konvensional dan sistem legacy yang lambat menjadi ekosistem web modern terpadu. Mempercepat siklus inovasi, menekan biaya operasional server, serta meningkatkan kepuasan pengguna akhir secara signifikan.",
      metric: "3x Lebih Cepat",
      metricLabel: "Peningkatan Efisiensi Operasional"
    }
  ];

  return (
    <section id="about" className="py-16 sm:py-20 md:py-28 bg-[#08080C] relative scroll-mt-24">
      {/* Decorative Cyber Border Grid */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3.5 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] sm:text-xs tracking-wider uppercase">
            <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Filosofi & Pendekatan Engineering</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Membangun Fondasi Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Kelas Enterprise</span>
          </h2>
          <p className="text-slate-400 text-[15px] sm:text-lg leading-relaxed">
            Sebagai <strong className="text-slate-200">Software Engineer, Backend Developer, dan Solution Architect</strong>, saya menggabungkan standar arsitektur modern dengan kebutuhan riil bisnis untuk menghasilkan produk digital yang tangguh, scalable, dan bernilai tinggi.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative rounded-2xl bg-white/[0.02] border border-red-500/20 hover:border-red-500/60 p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,30,56,0.15)] flex flex-col justify-between"
            >
              <div className="space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600/20 transition-all duration-300 flex-shrink-0">
                    {pillar.icon}
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs text-red-500/60 group-hover:text-red-400 transition-colors flex-shrink-0">
                    PILLAR // 0{idx + 1}
                  </span>
                </div>

                <h3 className="text-lg sm:text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-slate-300/80 text-sm sm:text-base leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              {/* Metric label and value stack on a phone — side by side the longest
                  label ("Peningkatan Efisiensi Operasional") squeezed the value. */}
              <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-800/80 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-[11px] sm:text-xs font-mono text-slate-400">{pillar.metricLabel}</span>
                <span className="font-mono font-bold text-sm sm:text-lg text-red-400 px-3 py-1 rounded bg-red-500/10 border border-red-500/25 flex-shrink-0">
                  {pillar.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enterprise Experience Summary Bar */}
        <div className="mt-8 sm:mt-12 p-5 sm:p-8 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#0F0F16] to-red-950/40 border border-red-500/30 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-base sm:text-xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span>Arsitektur Siap Pakai & Mudah Scale-Up</span>
            </h4>
            <p className="text-[13px] sm:text-sm text-slate-300 max-w-2xl">
              Setiap baris kode dan desain API dirancang untuk memudahkan perawatan jangka panjang (maintainability), pengujian otomatis, dan integrasi mulus dengan ekosistem enterprise yang sudah ada.
            </p>
          </div>

          <a
            href="#skills"
            className="w-full md:w-auto text-center px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-[13px] sm:text-sm uppercase tracking-wider transition-all duration-300 glow-red-sm whitespace-nowrap active:scale-[0.98]"
          >
            Lihat Keahlian <span className="hidden sm:inline">Teknis & Stack</span>
          </a>
        </div>
      </div>
    </section>
  );
};
