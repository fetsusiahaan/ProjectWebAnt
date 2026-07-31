import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Activity, CheckCircle } from 'lucide-react';

export const ArchitectureShowcase: FC = () => {
  const [activeTab, setActiveTab] = useState<'speed' | 'security' | 'scalability'>('speed');

  const tabs = [
    { id: 'speed', label: '⚡ Speed & Performance', title: 'Ultra-Fast Response Architecture (< 15ms)' },
    { id: 'security', label: '🔒 Enterprise Security', title: 'Zero-Trust Layered Security Model' },
    { id: 'scalability', label: '📈 Elastic Scalability', title: 'Kubernetes Multi-Region Auto-Scaling' },
  ];

  const content = {
    speed: {
      description: "Kecepatan bukan sekadar fitur, melainkan keunggulan kompetitif. Sistem yang dibangun oleh Fetsu Siahaan mengutamakan optimasi di setiap lapisan ekosistem aplikasi—mulai dari resolusi DNS hingga eksekusi query database.",
      metrics: [
        { label: "API Processing Latency", value: "< 15 ms", status: "Optimal" },
        { label: "Cache Hit Rate (Redis Cluster)", value: "98.4%", status: "High" },
        { label: "Max Concurrent Throughput", value: "25k+ Req/s", status: "Tested" },
      ],
      points: [
        "In-Memory Data Caching dengan Redis & Memcached untuk mengurangi beban I/O database relasional hingga 90%.",
        "Optimasi Database Indexing & Connection Pooling untuk menghindari bottleneck saat query berat.",
        "Asynchronous Background Workers dengan Apache Kafka / RabbitMQ untuk tugas intensif (email, report generation, notifikasi).",
        "Payload Compression & Protobuf gRPC untuk komunikasi antar microservices yang 5x lebih ringan dibanding JSON konvensional."
      ],
      diagram: [
        { node: "Client / CDN Edge", desc: "Edge Caching & SSL Termination" },
        { node: "API Gateway (FastAPI / Go)", desc: "Rate Limiting & JWT Auth < 2ms" },
        { node: "Redis Cluster Cache", desc: "Sub-millisecond In-Memory Lookup" },
        { node: "PostgreSQL High Availability", desc: "Read Replica & Optimized Queries" }
      ]
    },
    security: {
      description: "Keamanan sistem enterprise dirancang sejak baris kode pertama (Security by Design). Melindungi data pelanggan dan transaksi finansial dengan enkripsi tingkat militer dan kepatuhan standar industri.",
      metrics: [
        { label: "Encryption Standard", value: "AES-256", status: "Military" },
        { label: "SLA Threat Protection", value: "99.999%", status: "Active" },
        { label: "Vulnerability Score", value: "0 Critical", status: "Audited" },
      ],
      points: [
        "Zero-Trust Network Architecture dengan Mutual TLS (mTLS) di seluruh komunikasi microservices internal.",
        "Role-Based Access Control (RBAC) & OAuth2/OpenID Connect untuk otentikasi multi-faktor dan manajemen sesi yang aman.",
        "Proteksi Aktif OWASP Top 10 (SQL Injection, XSS, CSRF, SSRF) dengan Web Application Firewall (WAF) terintegrasi.",
        "Automated Security Scanning & Dependency Vulnerability Check terintegrasi langsung dalam pipa CI/CD."
      ],
      diagram: [
        { node: "Web App Firewall (WAF)", desc: "DDoS Mitigation & Rate Limit" },
        { node: "OAuth2 / JWT Security Layer", desc: "Token Validation & RBAC Policy" },
        { node: "Isolated Private VPC", desc: "No Direct Internet Exposure" },
        { node: "Encrypted Storage (AES-256)", desc: "Data At-Rest & KMS Keys" }
      ]
    },
    scalability: {
      description: "Sistem yang tangguh tidak boleh tumbang saat terjadi lonjakan trafik tiba-tiba (misal saat flash sale atau peluncuran produk). Arsitektur berorientasi cloud-native memastikan sistem mengembang dan menyusut secara otomatis.",
      metrics: [
        { label: "Auto-Scaling Response Time", value: "< 30 sec", status: "Elastic" },
        { label: "Multi-Region Uptime Target", value: "99.99%", status: "SLA" },
        { label: "Max Scale Capacity", value: "1M+ Users", status: "Enterprise" },
      ],
      points: [
        "Kubernetes (K8s) Horizontal Pod Autoscaler (HPA) yang menambah instance mikro-layanan berdasarkan penggunaan CPU/Memori.",
        "Database Sharding & Read/Write Splitting untuk mendistribusikan beban transaksi secara merata tanpa degradasi performa.",
        "Event-Driven Microservices yang terdesentralisasi, sehingga kegagalan pada satu layanan tidak mematikan sistem utama.",
        "Multi-Region Deployment & Disaster Recovery otomatis di AWS / Google Cloud Platform dengan failover instan."
      ],
      diagram: [
        { node: "Global Load Balancer", desc: "Geo-Routing & Health Checks" },
        { node: "K8s Auto-Scaling Clusters", desc: "Dynamic Pod Allocation" },
        { node: "Apache Kafka Event Bus", desc: "Decoupled Asynchronous Messaging" },
        { node: "Distributed Database Cluster", desc: "Multi-Region Read/Write Sync" }
      ]
    }
  };

  return (
    <section id="architecture" className="py-20 md:py-28 bg-[#08080C] relative overflow-hidden scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs tracking-wider uppercase">
            <Layers className="w-3.5 h-3.5" />
            <span>Showcase Arsitektur Sistem (Interactive)</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Mengapa Solusi Saya <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Cepat, Aman & Scalable?</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Klik pada setiap pilar di bawah ini untuk menjelajahi spesifikasi teknis, alur data (data flow), dan standar arsitektur yang saya terapkan dalam setiap proyek web dan REST API.
          </p>
        </div>

        {/* Tab Selection Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-4 rounded-xl font-bold text-sm sm:text-base border transition-all duration-300 flex items-center justify-center gap-2.5 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-red-600 to-red-500 border-red-400 text-white glow-red shadow-lg scale-[1.02]'
                  : 'bg-[#0F0F16] border-slate-800 text-slate-300 hover:border-red-500/40 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Box */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl bg-[#0F0F16] border border-red-500/30 p-6 sm:p-10 shadow-2xl relative overflow-hidden"
          >
            {/* Top Badge Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-800">
              <div>
                <span className="font-mono text-xs text-red-400 uppercase tracking-widest">// SPECIFICATION OVERVIEW</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {tabs.find(t => t.id === activeTab)?.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 font-mono text-xs text-red-300 w-fit">
                <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                <span>ARCH_STATUS: ENTERPRISE READY</span>
              </div>
            </div>

            {/* Main Grid: Description & Metrics + Architecture Pipeline Diagram */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              
              {/* Left Side: Points & Metrics */}
              <div className="lg:col-span-7 space-y-6">
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                  {content[activeTab].description}
                </p>

                {/* Metrics Badges Row */}
                <div className="grid grid-cols-3 gap-3">
                  {content[activeTab].metrics.map((m, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-white/[0.03] border border-red-500/20 text-center">
                      <span className="text-[10px] font-mono text-slate-400 block mb-1">{m.label}</span>
                      <span className="text-base sm:text-xl font-bold font-mono text-white tracking-tight">{m.value}</span>
                      <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">{m.status}</span>
                    </div>
                  ))}
                </div>

                {/* Bullet Points */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-red-500" />
                    <span>Key Engineering Highlights:</span>
                  </h4>
                  <ul className="space-y-2.5">
                    {content[activeTab].points.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300 text-sm sm:text-base">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Side: Simulated Pipeline Diagram */}
              <div className="lg:col-span-5 bg-black/70 border border-red-500/25 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 font-mono text-xs text-slate-400">
                  <span>SYSTEM_FLOW // PIPELINE</span>
                  <span className="text-red-400">STAGE 1 TO 4</span>
                </div>

                <div className="space-y-3 pt-1">
                  {content[activeTab].diagram.map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="p-3.5 rounded-lg bg-white/[0.04] border border-red-500/30 hover:border-red-500 transition-colors flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-red-400 block">// STEP 0{idx + 1}</span>
                          <span className="text-white font-bold text-sm sm:text-base block mt-0.5">{item.node}</span>
                          <span className="text-xs text-slate-400 block mt-0.5">{item.desc}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-mono text-xs font-bold">
                          {idx + 1}
                        </div>
                      </div>
                      
                      {idx < content[activeTab].diagram.length - 1 && (
                        <div className="flex justify-center my-1.5">
                          <div className="w-0.5 h-4 bg-gradient-to-b from-red-500 to-red-500/20 animate-pulse" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 text-center">
                  <span className="inline-block px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
                    ✓ PIPELINE VERIFIED BY FETSU SIAHAAN
                  </span>
                </div>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
};
