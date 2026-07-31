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
    <section id="about" className="py-20 md:py-28 bg-[#08080C] relative scroll-mt-24">
      {/* Decorative Cyber Border Grid */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs tracking-wider uppercase">
            <Cpu className="w-3.5 h-3.5" />
            <span>Filosofi & Pendekatan Engineering</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Membangun Fondasi Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Kelas Enterprise</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Sebagai <strong className="text-slate-200">Software Engineer, Backend Developer, dan Solution Architect</strong>, saya menggabungkan standar arsitektur modern dengan kebutuhan riil bisnis untuk menghasilkan produk digital yang tangguh, scalable, dan bernilai tinggi.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative rounded-2xl bg-white/[0.02] border border-red-500/20 hover:border-red-500/60 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,30,56,0.15)] flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600/20 transition-all duration-300">
                    {pillar.icon}
                  </div>
                  <span className="font-mono text-xs text-red-500/60 group-hover:text-red-400 transition-colors">
                    PILLAR // 0{idx + 1}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-slate-300/80 text-sm sm:text-base leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              {/* Bottom Metric Badge */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">{pillar.metricLabel}</span>
                <span className="font-mono font-bold text-base sm:text-lg text-red-400 px-3 py-1 rounded bg-red-500/10 border border-red-500/25">
                  {pillar.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enterprise Experience Summary Bar */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#0F0F16] to-red-950/40 border border-red-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <CheckCircle className="w-5 h-5 text-red-500" />
              <span>Arsitektur Siap Pakai & Mudah Scale-Up</span>
            </h4>
            <p className="text-sm text-slate-300 max-w-2xl">
              Setiap baris kode dan desain API dirancang untuk memudahkan perawatan jangka panjang (maintainability), pengujian otomatis, dan integrasi mulus dengan ekosistem enterprise yang sudah ada.
            </p>
          </div>
          
          <a
            href="#skills"
            className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm uppercase tracking-wider transition-all duration-300 glow-red-sm whitespace-nowrap"
          >
            Lihat Keahlian Teknis & Stack
          </a>
        </div>
      </div>
    </section>
  );
};
