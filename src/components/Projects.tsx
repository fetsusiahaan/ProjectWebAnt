import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Terminal, ArrowUpRight } from 'lucide-react';

export const Projects: FC = () => {
  const projects = [
    {
      title: "Enterprise Core Banking & Payment REST API Gateway",
      category: "Fintech // High-Throughput REST API",
      description: "Arsitektur REST API berkinerja tinggi untuk pemrosesan transaksi pembayaran multi-bank. Dirancang menggunakan Go (Golang) dan Redis cluster, mampu menangani 25,000 request/detik dengan latensi pemrosesan rata-rata hanya 9.2 milidetik serta enkripsi end-to-end.",
      stack: ["Go (Golang)", "PostgreSQL", "Redis Cluster", "Kubernetes", "gRPC", "Docker"],
      metrics: { latency: "9.2 ms", throughput: "25k req/s", uptime: "99.999%" },
      highlight: "Super Cepat & Aman"
    },
    {
      title: "Logistics & Supply Chain Intelligence Platform",
      category: "Enterprise Web App // Microservices",
      description: "Platform berbasis web modern untuk pelacakan armada logistik real-time dan optimasi rute otomatis. Mengintegrasikan event-driven pipeline Apache Kafka untuk memproses jutaan titik koordinat GPS tanpa membebani database utama.",
      stack: ["React + Vite", "Node.js (TypeScript)", "Apache Kafka", "PostgreSQL", "Tailwind CSS"],
      metrics: { latency: "14 ms", throughput: "12k req/s", uptime: "99.99%" },
      highlight: "Real-Time Scalable"
    },
    {
      title: "Cloud Native Telemetry & Monitoring Dashboard",
      category: "Cloud Architecture // Analytics",
      description: "Sistem dasbor analitik enterprise yang menyajikan metrik kesehatan cloud dan log server secara live. Menggunakan arsitektur WebSocket dan ClickHouse untuk rendering visual super lancar tanpa lag saat memonitor ribuan node.",
      stack: ["React (Vite)", "Python FastAPI", "ClickHouse", "WebSocket", "AWS EKS", "Tailwind CSS"],
      metrics: { latency: "11 ms", throughput: "18k req/s", uptime: "99.995%" },
      highlight: "High Performance UI"
    },
    {
      title: "Healthcare Interoperability & Data API Engine",
      category: "HealthTech // High Security API",
      description: "Engine pertukaran data medis berbasis REST API yang memenuhi standar keamanan HIPAA dan FHIR. Dilengkapi dengan otentikasi OAuth2/JWT berlapis dan audit trail otomatis untuk perlindungan privasi data pasien secara penuh.",
      stack: ["Java Spring Boot", "PostgreSQL", "Docker", "AWS KMS", "Redis", "OAuth2 / JWT"],
      metrics: { latency: "13.5 ms", throughput: "10k req/s", uptime: "100% Secure" },
      highlight: "Enterprise Security"
    }
  ];

  return (
    <section id="projects" className="py-20 md:py-28 bg-[#0B0B10] relative overflow-hidden scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs tracking-wider uppercase">
            <Terminal className="w-3.5 h-3.5" />
            <span>Portofolio Solusi & Proyek Unggulan</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Solusi Nyata untuk <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Efisiensi Bisnis</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Berikut adalah studi kasus implementasi aplikasi web modern, REST API, dan sistem enterprise yang telah dirancang untuk memenuhi standar tertinggi dalam kecepatan, keamanan, dan skalabilitas.
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project, idx) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="group rounded-2xl bg-[#0F0F16] border border-red-500/20 hover:border-red-500/70 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,30,56,0.2)] flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent Ribbon */}
              <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl bg-red-600 text-white font-mono text-[10px] font-bold uppercase tracking-widest shadow-md">
                {project.highlight}
              </div>

              <div className="space-y-4">
                <span className="text-xs font-mono text-red-400/80 uppercase tracking-wider block">
                  {project.category}
                </span>

                <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
                  {project.title}
                </h3>

                <p className="text-slate-300/85 text-sm sm:text-base leading-relaxed">
                  {project.description}
                </p>

                {/* Tech Stack Chips */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-slate-800 text-xs font-mono text-slate-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Metrics Bar & Action */}
              <div className="mt-8 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="grid grid-cols-3 gap-3 w-full sm:w-auto text-center sm:text-left">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Latency</span>
                    <span className="font-mono font-bold text-red-400 text-sm sm:text-base">{project.metrics.latency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Capacity</span>
                    <span className="font-mono font-bold text-white text-sm sm:text-base">{project.metrics.throughput}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Uptime</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm sm:text-base">{project.metrics.uptime}</span>
                  </div>
                </div>

                <a
                  href="#contact"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white font-semibold text-xs tracking-wider uppercase border border-red-500/30 transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Minta Spesifikasi</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enterprise Callout */}
        <div className="mt-16 text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm sm:text-base uppercase tracking-wider transition-all duration-300 glow-red hover:glow-red-lg shadow-xl"
          >
            <span>Konsultasikan Kebutuhan Proyek atau Sistem Anda</span>
            <ArrowUpRight className="w-5 h-5" />
          </a>
        </div>

      </div>
    </section>
  );
};
