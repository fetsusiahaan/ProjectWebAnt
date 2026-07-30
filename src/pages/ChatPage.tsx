import { useState, useRef, useEffect } from 'react';
import type { FC, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Send, ArrowLeft, Bot, User, Zap,
  Shield, Server, Code2, Database, Cloud, Cpu,
  RefreshCw, Activity, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  typing?: boolean;
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────
const knowledgeBase: { patterns: RegExp[]; response: string }[] = [
  {
    patterns: [/halo|hai|hi|hello|hey|selamat/i],
    response:
      '👋 Halo! Saya **FetsuBot** — asisten virtual Fetsu Siahaan.\n\nSaya siap menjawab pertanyaan seputar:\n• 💼 Pengalaman & keahlian teknis\n• 🛠️ Layanan & solusi yang ditawarkan\n• 📦 Proyek & arsitektur sistem\n• 📬 Cara menghubungi Fetsu\n\nAda yang ingin Anda ketahui?',
  },
  {
    patterns: [/siapa.*(kamu|kau|anda|fetsu|dia)|fetsu itu siapa|tentang fetsu/i],
    response:
      '**Fetsu Siahaan** adalah seorang:\n\n🧠 **Software Engineer** — spesialis backend dan sistem enterprise\n⚡ **Backend Developer** — membangun REST API performa tinggi\n🏗️ **Solution Architect** — merancang sistem cloud-native yang scalable\n\nBerpengalaman dalam membangun solusi web modern yang cepat, aman, dan siap skala enterprise. Berbasis di Indonesia, melayani klien lokal dan internasional.',
  },
  {
    patterns: [/keahlian|skill|kemampuan|bisa apa|expert|spesialisasi/i],
    response:
      '🔧 **Tech Stack & Keahlian Fetsu:**\n\n**Backend & API:**\n• Go (Golang) · Rust · Node.js · Python\n• REST API · gRPC · GraphQL · WebSocket\n\n**Database:**\n• PostgreSQL · MySQL · Redis · MongoDB\n• Elasticsearch · TimescaleDB\n\n**Cloud & DevOps:**\n• AWS · GCP · Docker · Kubernetes\n• CI/CD · Terraform · Prometheus · Grafana\n\n**Frontend:**\n• React · Next.js · TypeScript · Vite\n\nSemua dengan standar enterprise dan security best practices.',
  },
  {
    patterns: [/layanan|service|jasa|bisa bantu|solusi|minta bantuan/i],
    response:
      '🚀 **Layanan yang Ditawarkan:**\n\n1. **REST API & Microservices** — desain, build & optimasi API enterprise\n2. **Web Application** — React, Next.js, TypeScript fullstack\n3. **Cloud Architecture** — AWS/GCP, Kubernetes, auto-scaling infra\n4. **Database Optimization** — query tuning, sharding, caching strategy\n5. **Security Audit** — penetration testing, secure coding review\n6. **Solution Architecture Consulting** — desain sistem dari nol\n\nIngin konsultasi lebih lanjut? Klik tombol **"Hubungi Fetsu"** di bawah!',
  },
  {
    patterns: [/proyek|project|portfolio|karya|kerja|pernah buat/i],
    response:
      '📦 **Proyek Unggulan Fetsu:**\n\n🔴 **Enterprise API Gateway** — sistem proxy & rate-limiting untuk 10k+ req/sec\n🔴 **E-Commerce Platform** — microservices dengan Go, PostgreSQL & Redis cluster\n🔴 **Real-time Analytics Dashboard** — streaming data pipeline dengan Kafka\n🔴 **Cloud Migration** — migrasi on-premise ke Kubernetes di GCP\n🔴 **Security Hardening** — implementasi WAF, JWT auth & AES-256 encryption\n\nSetiap proyek dibangun dengan standar uptime 99.99% dan latency < 20ms.',
  },
  {
    patterns: [/harga|biaya|tarif|berapa|bayar|cost|price|rate/i],
    response:
      '💰 **Informasi Harga:**\n\nHarga bersifat fleksibel tergantung:\n• Kompleksitas & scope proyek\n• Durasi pengerjaan\n• Level kebutuhan (MVP / Enterprise)\n\nUntuk estimasi yang akurat, silakan **hubungi langsung** melalui:\n📧 Email: fetsusiahaan.dev@gmail.com\n\nAtau isi form kontak di halaman utama untuk mendapatkan proposal teknis & harga resmi.',
  },
  {
    patterns: [/kontak|hubungi|email|linkedin|github|reach|contact/i],
    response:
      '📬 **Cara Menghubungi Fetsu:**\n\n📧 **Email:** fetsusiahaan.dev@gmail.com\n💼 **LinkedIn:** linkedin.com/in/fetsu-siahaan\n🐙 **GitHub:** github.com/fetsusiahaan\n\n⏱️ **Response time:** < 24 jam kerja\n🔒 **NDA & Enterprise Security** tersedia\n\nAtau kembali ke halaman utama dan isi form **"Kirim Pesan"** langsung!',
  },
  {
    patterns: [/api|rest|endpoint|backend|server|microservice/i],
    response:
      '⚡ **REST API & Backend Expertise:**\n\nFetsu membangun API dengan:\n• **Throughput:** 14.000+ req/sec\n• **Latency P99:** < 12ms\n• **Uptime SLA:** 99.998%\n\nStack favorit: **Go (Fiber/Echo)** + **PostgreSQL** + **Redis** + **Docker**\n\nFitur standar: JWT Auth, Rate Limiting, Swagger Docs, Health Checks, Graceful Shutdown, structured logging.',
  },
  {
    patterns: [/golang|go lang|rust|python|node|typescript|javascript|react|next/i],
    response:
      '💻 **Bahasa & Framework:**\n\n🥇 **Go (Golang)** — backend utama, API performa tinggi\n🥈 **Rust** — sistem keamanan & low-latency critical path\n🥉 **Python** — scripting, ML pipeline, data processing\n🔷 **TypeScript/React** — frontend modern & Next.js SSR\n🟩 **Node.js** — real-time apps & WebSocket\n\nFetsu memilih stack berdasarkan kebutuhan bisnis, bukan hype. Setiap pilihan didasarkan pada data performa nyata.',
  },
  {
    patterns: [/cloud|aws|gcp|azure|kubernetes|docker|devops|deploy/i],
    response:
      '☁️ **Cloud & DevOps:**\n\n**Platforms:** AWS (EC2, RDS, EKS, S3, Lambda) · GCP (GKE, Cloud Run)\n**Containers:** Docker · Kubernetes · Helm Charts\n**CI/CD:** GitHub Actions · GitLab CI · ArgoCD\n**IaC:** Terraform · Ansible\n**Monitoring:** Prometheus · Grafana · ELK Stack · Datadog\n\nFetsu menerapkan prinsip **zero-downtime deployment** dan **chaos engineering** untuk sistem resilient.',
  },
  {
    patterns: [/database|db|sql|postgres|mysql|redis|mongodb|nosql/i],
    response:
      '🗄️ **Database Expertise:**\n\n**Relational:** PostgreSQL (expert) · MySQL · SQLite\n**NoSQL:** MongoDB · Redis · Elasticsearch\n**Time-series:** TimescaleDB · InfluxDB\n\nKeahlian khusus:\n• Query optimization & indexing strategy\n• Read replica & sharding setup\n• Redis caching layer design\n• Database migration zero-downtime\n• Connection pooling (PgBouncer)',
  },
  {
    patterns: [/security|keamanan|enkripsi|encrypt|auth|jwt|oauth/i],
    response:
      '🛡️ **Security & Authentication:**\n\nFetsu menerapkan standar keamanan enterprise:\n• **AES-256-GCM** encryption at rest & in transit\n• **JWT + Refresh Token** rotation strategy\n• **OAuth 2.0 / OIDC** integration\n• **WAF** (Web Application Firewall) setup\n• **Rate Limiting** & DDoS protection\n• **OWASP Top 10** mitigation\n• **Penetration Testing** & vulnerability assessment\n\nKeamanan bukan fitur tambahan — ini adalah fondasi.',
  },
  {
    patterns: [/waktu|lama|durasi|berapa lama|deadline|timeline|estimasi/i],
    response:
      '⏳ **Estimasi Waktu Pengerjaan:**\n\n• **MVP / Prototype:** 1–2 minggu\n• **REST API (medium):** 2–4 minggu\n• **Fullstack Web App:** 4–8 minggu\n• **Enterprise System:** 2–6 bulan\n• **Konsultasi Arsitektur:** 1–3 hari\n\nWaktu bisa bervariasi tergantung kompleksitas. Fetsu selalu mengedepankan **kualitas** tanpa mengorbankan **timeline** yang disepakati.',
  },
  {
    patterns: [/pengalaman|experience|kerja|karir|tahun/i],
    response:
      '📅 **Pengalaman Profesional:**\n\nFetsu Siahaan telah berpengalaman di:\n• Pengembangan sistem enterprise skala besar\n• Arsitektur microservices untuk perusahaan fintech & e-commerce\n• Optimasi performa sistem dengan throughput tinggi\n• Konsultasi transformasi digital untuk berbagai industri\n\nSetiap proyek dikerjakan dengan standar **enterprise-grade** dan komitmen penuh terhadap kualitas delivery.',
  },
  {
    patterns: [/terima kasih|makasih|thanks|thank you|mantap|keren|bagus|hebat/i],
    response:
      '😊 Sama-sama! Senang bisa membantu.\n\nJika ada pertanyaan lain atau Anda siap untuk memulai project bersama Fetsu, jangan ragu untuk:\n• Lanjutkan chat di sini\n• Atau isi form kontak di **halaman utama**\n\nFetsu siap membantu transformasi digital Anda! 🚀',
  },
  {
    patterns: [/bye|dadah|sampai jumpa|selamat tinggal|exit|quit|close/i],
    response:
      '👋 Sampai jumpa! Terima kasih sudah mampir ke chat Fetsu.\n\nJika Anda membutuhkan bantuan atau ingin mulai project, ingat:\n📧 fetsusiahaan.dev@gmail.com\n\n**"Building the future, one commit at a time."** — Fetsu Siahaan ✨',
  },
];

const FALLBACK_RESPONSES = [
  '🤔 Hmm, saya belum punya jawaban spesifik untuk itu. Coba tanyakan tentang:\n• Keahlian & layanan Fetsu\n• Cara menghubungi\n• Estimasi harga & waktu\n• Proyek & teknologi yang digunakan',
  '💡 Pertanyaan menarik! Untuk jawaban yang lebih detail mengenai topik ini, silakan **hubungi Fetsu langsung** melalui email atau form kontak di halaman utama.',
  '🔍 Saya tidak menemukan informasi spesifik tentang itu. Tapi saya bisa membantu dengan pertanyaan seputar keahlian teknis, layanan, atau cara menghubungi Fetsu Siahaan!',
];

function getBotResponse(input: string): string {
  const trimmed = input.trim().toLowerCase();
  for (const entry of knowledgeBase) {
    if (entry.patterns.some((p) => p.test(trimmed))) {
      return entry.response;
    }
  }
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// Format bold **text** and bullet •
function renderFormattedText(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i} className="block">
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="text-white font-semibold">
              {part}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
        {i < text.split('\n').length - 1 && ' '}
      </span>
    );
  });
}

// ─── Quick Prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Siapa Fetsu?', icon: <User className="w-3 h-3" /> },
  { label: 'Layanan apa saja?', icon: <Server className="w-3 h-3" /> },
  { label: 'Tech stack?', icon: <Code2 className="w-3 h-3" /> },
  { label: 'Berapa harganya?', icon: <Zap className="w-3 h-3" /> },
  { label: 'Cara menghubungi?', icon: <Database className="w-3 h-3" /> },
  { label: 'Cloud & DevOps?', icon: <Cloud className="w-3 h-3" /> },
];

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator: FC = () => (
  <div className="flex items-center gap-1.5 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-red-500"
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
      />
    ))}
  </div>
);

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export const ChatPage: FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'bot',
      text: '👋 Halo! Saya **FetsuBot** — asisten virtual Fetsu Siahaan, Software Engineer & Solution Architect.\n\nSilakan tanyakan apa saja tentang keahlian, layanan, proyek, atau cara menghubungi Fetsu. Saya siap membantu! 🚀',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msgText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const delay = 700 + Math.random() * 800;
    setTimeout(() => {
      const botReply: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: getBotResponse(msgText),
        timestamp: new Date(),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, botReply]);
    }, delay);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage();
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'init-reset',
        role: 'bot',
        text: '🔄 Sesi chat baru dimulai. Ada yang bisa saya bantu?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#08080C] flex flex-col text-slate-100 font-sans selection:bg-red-600 selection:text-white">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#08080C]/90 backdrop-blur-md border-b border-red-500/25 shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Back */}
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Kembali ke Beranda</span>
            <span className="sm:hidden">Kembali</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">FetsuBot</p>
              <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Online — AI Assistant
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              title="Reset Chat"
              className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-red-500/30 text-xs font-mono text-red-400">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Chat Body ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">

          {/* Terminal-style header card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#0F0F16]/80 border border-red-500/20 p-4 mb-2"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 font-mono text-xs text-slate-400">bash: ./fetsu_ai_assistant.sh</span>
              </div>
              <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                AI ASSISTANT v1.0
              </span>
            </div>
            <div className="font-mono text-xs text-slate-500 space-y-0.5">
              <p><span className="text-red-400">$</span> <span className="text-emerald-400">init</span> FetsuBot --model=knowledge-base --persona=fetsu-siahaan</p>
              <p><span className="text-red-400">$</span> <span className="text-slate-300">Status: Ready</span> <span className="text-emerald-400">✓</span></p>
            </div>
          </motion.div>

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                    msg.role === 'bot'
                      ? 'bg-red-600/15 border-red-500/40 text-red-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  {msg.role === 'bot' ? (
                    <Cpu className="w-4.5 h-4.5" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'bot'
                        ? 'bg-[#0F0F16] border border-slate-800 text-slate-300 rounded-tl-sm'
                        : 'bg-gradient-to-br from-red-600 to-red-500 text-white rounded-tr-sm shadow-lg shadow-red-900/30'
                    }`}
                  >
                    {msg.role === 'bot'
                      ? renderFormattedText(msg.text)
                      : msg.text}
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 px-1">
                    {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex gap-3 items-start"
              >
                <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="bg-[#0F0F16] border border-slate-800 rounded-2xl rounded-tl-sm">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Bottom Input Area ───────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-[#08080C]/95 backdrop-blur-md border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-3">

          {/* Quick Prompts */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => sendMessage(p.label)}
                disabled={isTyping}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 hover:border-red-500/50 hover:text-red-400 text-slate-400 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={isTyping}
                placeholder="Ketik pertanyaan Anda tentang Fetsu Siahaan..."
                className="w-full px-4 py-3 pr-12 rounded-xl bg-[#0F0F16] border border-slate-800 focus:border-red-500/70 text-white placeholder-slate-600 focus:outline-none transition-colors font-mono text-sm disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-600">
                ↵
              </span>
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-900/30 disabled:shadow-none flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Footer note */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              Percakapan bersifat privat &amp; aman
            </span>
            <Link to="/#contact" className="flex items-center gap-1 text-red-500/60 hover:text-red-400 transition-colors">
              <span>Hubungi Fetsu langsung</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
