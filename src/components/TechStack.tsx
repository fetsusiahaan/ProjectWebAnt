import { useState } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';

type SkillCategory = 'all' | 'backend' | 'cloud' | 'frontend' | 'database';

const categories: Array<{ id: SkillCategory; label: string }> = [
  { id: 'all', label: 'Semua Keahlian' },
  { id: 'backend', label: 'Backend & REST API' },
  { id: 'cloud', label: 'Cloud Architecture & DevOps' },
  { id: 'database', label: 'Database & Messaging' },
  { id: 'frontend', label: 'Modern Web & Frontend' },
];

export const TechStack: FC = () => {
  const [activeTab, setActiveTab] = useState<SkillCategory>('all');

  const skills = [
    { name: 'Go (Golang)', category: 'backend', level: 'Expert', desc: 'High-concurrency microservices & ultra-fast APIs', icon: '⚡' },
    { name: 'Node.js & TypeScript', category: 'backend', level: 'Expert', desc: 'Event-driven backend, Express, NestJS, REST API', icon: '🟢' },
    { name: 'Python (FastAPI / Django)', category: 'backend', level: 'Advanced', desc: 'Async API service, AI/Data pipeline backend', icon: '🐍' },
    { name: 'Java (Spring Boot)', category: 'backend', level: 'Advanced', desc: 'Enterprise core banking & transactional services', icon: '☕' },
    { name: 'REST API & gRPC', category: 'backend', level: 'Expert', desc: 'Low-latency API architecture & protocol buffer communication', icon: '🔌' },
    
    { name: 'Docker & Containerization', category: 'cloud', level: 'Expert', desc: 'Multi-stage build, container security, optimization', icon: '🐳' },
    { name: 'Kubernetes (K8s)', category: 'cloud', level: 'Expert', desc: 'Pod orchestration, auto-scaling, ingress management', icon: '☸️' },
    { name: 'AWS & Google Cloud Platform', category: 'cloud', level: 'Expert', desc: 'ECS, EKS, Lambda, S3, Cloud Run, VPC Architecture', icon: '☁️' },
    { name: 'CI/CD Pipelines & GitHub Actions', category: 'cloud', level: 'Advanced', desc: 'Automated testing, continuous deployment & security scans', icon: '🚀' },
    
    { name: 'PostgreSQL & MySQL', category: 'database', level: 'Expert', desc: 'High-availability clustering, indexing & query tuning', icon: '🐘' },
    { name: 'Redis Caching Layer', category: 'database', level: 'Expert', desc: 'In-memory data store for sub-millisecond API response', icon: '🔴' },
    { name: 'MongoDB & NoSQL', category: 'database', level: 'Advanced', desc: 'Document store for highly flexible schema requirements', icon: '🍃' },
    { name: 'Apache Kafka & RabbitMQ', category: 'database', level: 'Advanced', desc: 'Event-driven message broker for microservices decoupled flow', icon: '📨' },
    
    { name: 'React & TypeScript', category: 'frontend', level: 'Expert', desc: 'Component architecture, state management & reactive UI', icon: '⚛️' },
    { name: 'Vite.js & Next.js', category: 'frontend', level: 'Expert', desc: 'Ultra-fast build tool, server-side rendering & SEO optimization', icon: '⚡' },
    { name: 'Tailwind CSS v4', category: 'frontend', level: 'Expert', desc: 'Modern responsive design system & custom animations', icon: '🎨' },
  ];

  const filteredSkills = activeTab === 'all'
    ? skills
    : skills.filter(skill => skill.category === activeTab);

  return (
    <section id="skills" className="py-16 sm:py-20 md:py-28 bg-[#0B0B10] relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3.5 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] sm:text-xs tracking-wider uppercase">
            <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Keahlian & Teknologi Utama</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Spektrum Teknologi <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Enterprise & Scalable</span>
          </h2>
          <p className="text-slate-400 text-[15px] sm:text-lg">
            Sistem yang cepat dan aman membutuhkan pemilihan teknologi yang tepat. Berikut adalah stack teknologi yang saya kuasai dan gunakan dalam merancang solusi bisnis digital.
          </p>
        </div>

        {/* Filter Tabs — five long labels wrapped into ragged centred rows on a
            phone, so below sm they become a single horizontal scroll strip. */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-8 sm:mb-12 overflow-x-auto no-scrollbar fade-edge-r sm:[mask-image:none]">
          <div className="flex items-center gap-2 sm:gap-3 w-max sm:w-auto sm:flex-wrap sm:justify-center">
            {categories.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-red-600 text-white glow-red-sm shadow-lg'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-red-500/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {filteredSkills.map((skill) => (
            <motion.div
              layout
              key={skill.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="group rounded-xl bg-[#0F0F16]/90 border border-red-500/20 hover:border-red-500/70 p-4 sm:p-5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,30,56,0.2)] flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl sm:text-2xl">{skill.icon}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-semibold uppercase tracking-wider flex-shrink-0">
                    {skill.level}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                  {skill.name}
                </h3>

                <p className="text-slate-400 text-[13px] sm:text-sm leading-relaxed">
                  {skill.desc}
                </p>
              </div>

              {/* Progress Indicator Simulation */}
              <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Proficiency</span>
                <div className="w-20 sm:w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                  <div className={`h-full bg-gradient-to-r from-red-600 to-red-400 ${
                    skill.level === 'Expert' ? 'w-[95%]' : 'w-[85%]'
                  }`} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Architecture Principle Callout */}
        <div className="mt-10 sm:mt-14 p-5 sm:p-6 rounded-2xl bg-black border border-red-500/30 flex items-start sm:items-center gap-3 sm:gap-4 text-slate-300 text-[12px] sm:text-sm font-mono sm:justify-center leading-relaxed">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0" />
          <span>TECH PHILOSOPHY: &quot;Pilih teknologi berdasarkan ketahanan, skalabilitas, dan efisiensi jangka panjang, bukan sekadar tren sementara.&quot; — Fetsu Siahaan</span>
        </div>
      </div>
    </section>
  );
};
