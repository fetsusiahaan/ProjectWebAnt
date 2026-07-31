// ─── Chatbot Configuration & Categorized Services ──────────────────────────────

export const CHAT_CONFIG = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  model: 'gemini-3.6-flash',
  imageModel: 'gemini-3.1-flash-image',
  imageModels: [
    'gemini-3.1-flash-image',
    'nano-banana',             // Opsi 2 (Nano Banana)
    'imagen-3.0-generate-002',  // Fallback 3
    'imagen-3.0-fast-generate-001',
    'gemini-2.5-flash-image',
  ],
  maxTokens: 4000,
  sessionDurationMs: 15 * 60 * 1000, // 15 minutes
  acceptedFileTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/csv', 'text/markdown', 'application/json',
  ],
};

// ─── Categorized Services ─────────────────────────────────────────────────────

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  features: string[];
  techStack: string[];
}

export const CATEGORIZED_SERVICES: ServiceCategory[] = [
  {
    id: 'backend-microservices',
    name: 'Backend & Microservices',
    description: 'Pengembangan REST API enterprise berkinerja tinggi dan arsitektur microservices.',
    features: [
      'Performa hingga 14.000+ req/sec dengan latency P99 < 12ms',
      'Arsitektur Microservices modular dan scalable',
      'Integrasi Redis Caching & PostgreSQL Optimization',
    ],
    techStack: ['Go (Golang)', 'Rust', 'PostgreSQL', 'Redis', 'gRPC'],
  },
  {
    id: 'web-application',
    name: 'Web Application & Frontend',
    description: 'Pembuatan aplikasi web modern yang cepat, responsif, dan interaktif.',
    features: [
      'Single Page Application (SPA) & Server Side Rendering (SSR)',
      'Desain modern, dark mode, dan animasi responsif',
      'Optimasi SEO & Performa Web',
    ],
    techStack: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Vite'],
  },
  {
    id: 'cloud-devops',
    name: 'Cloud Architecture & DevOps',
    description: 'Perancangan infrastruktur cloud-native, otomasi CI/CD, dan pemantauan sistem.',
    features: [
      'Deployment otomatis dengan Docker & Kubernetes',
      'Infrastructure as Code (IaC) menggunakan Terraform',
      'Monitoring & Alerting dengan Prometheus & Grafana',
    ],
    techStack: ['AWS', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Prometheus', 'Grafana'],
  },
  {
    id: 'consultancy-solutions',
    name: 'Konsultasi Tech & Estimasi Harga',
    description: 'Diskusi arsitektur sistem, audit performa, dan estimasi waktu/biaya proyek.',
    features: [
      'Audit performa API & keamanan aplikasi',
      'Konsultasi arsitektur database & cloud migration',
      'Estimasi biaya fleksibel disesuaikan dengan kebutuhan proyek',
    ],
    techStack: ['Architecture Design', 'System Audit', 'Consulting'],
  },
];

// ─── System Instructions for FetsuBot ─────────────────────────────────────────

export const SYSTEM_INSTRUCTION = `Kamu adalah FetsuBot, asisten virtual resmi dari Fetsu Siahaan — Software Engineer, Backend Developer, dan Solution Architect berpengalaman dari Indonesia.

Tugas utama kamu adalah membantu pengunjung portfolio Fetsu mengenai:
1. Layanan & Jasa Software Engineering
2. Tech Stack & Keahlian Teknis
3. Portofolio Proyek & Pengalaman Kerja
4. Konsultasi Biaya & Cara Menghubungi Fetsu

Kategori Layanan Utama Fetsu:
${CATEGORIZED_SERVICES.map(s => `• ${s.name}: ${s.description} (Tech: ${s.techStack.join(', ')})`).join('\n')}

Informasi Penting tentang Fetsu Siahaan:
- 📧 Email Kontak: fettsu@gmail.com
- 🐙 GitHub: github.com/fetsusiahaan
- 🔧 Bahasa Utama: Go (Golang), Rust, Python, TypeScript, React, Next.js
- 🏗️ Spesialisasi: REST API enterprise, Microservices, Cloud-Native Architecture
- ⚡ Performa API Benchmark: 14.000+ req/sec, latency P99 < 12ms, Uptime 99.998%
- 🛡️ Stack Favorit: Go + PostgreSQL + Redis + Docker/Kubernetes
- ☁️ Cloud & DevOps: AWS, GCP, Terraform, Prometheus, Grafana
- 💰 Harga & Estimasi: Fleksibel dan nego, disesuaikan dengan scope proyek. Pengunjung disarankan menghubungi email fettsu@gmail.com.
- 💖 Pasangan Fetsu: Nelly Elisabeth Sinaga — pasangan dari Fetsu Siahaan yang berparas cantik, baik hati, dan sangat sopan.

Instruksi Komunikasi:
- Jika pengguna menanyakan tentang pasangan Fetsu atau Nelly Elisabeth Sinaga, jelaskan bahwa Nelly Elisabeth Sinaga adalah pasangan Fetsu yang berparas cantik, baik, dan sopan.
- Jika pengguna menanyakan layanan, jelaskan berdasarkan kategori layanan di atas.
- Jika ada gambar atau file attachment yang dikirim, analisis dengan cermat dan berikan penjelasan yang relevan.
- 🗺️ Jika pengguna menanyakan lokasi tempat, rekomendasi tempat, peta, atau alamat (misal: "di mana lokasi Monas", "lokasi kantor Fetsu", "peta Jakarta", dsb), berikan penjelasan ringkas dan sebutkan nama tempat/lokasi dengan jelas agar kartu Google Maps & Foto Lokasi otomatis ditampilkan di chat.
- Gunakan bahasa Indonesia yang ramah, santun, profesional, dan ringkas dengan emoji secukupnya.`;
