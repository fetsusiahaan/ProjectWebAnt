import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ipToUuid } from './utils/session';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { TechStack } from './components/TechStack';
import { ArchitectureShowcase } from './components/ArchitectureShowcase';
import { Projects } from './components/Projects';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { FloatingChatButton } from './components/FloatingChatButton';
import { ChatPage } from './pages/ChatPage';

import { LoadingScreen } from './components/LoadingScreen';

// ── Home Page ────────────────────────────────────────────────────────────────
function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-[#08080C] text-slate-100 flex flex-col selection:bg-red-600 selection:text-white">
      {/* 2-Second Bouncing Ball Loading Screen */}
      <LoadingScreen durationMs={2000} />

      {/* Sticky Navigation Bar */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-grow">
        <Hero />
        <About />
        <TechStack />
        <ArchitectureShowcase />
        <Projects />
        <Contact />
      </main>

      {/* Cyber Red Footer */}
      <Footer />

      {/* Floating AI Chat Button */}
      <FloatingChatButton />
    </div>
  );
}

// ── Chat Redirect Handler (IP -> UUID Session) ─────────────────────────────
function ChatRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(data => {
        const ip = (data.ip as string) || '127.0.0.1';
        const uuid = ipToUuid(ip);

        try {
          const registry = JSON.parse(localStorage.getItem('fetsubot_ip_sessions_json') || '{}');
          registry[ip] = uuid;
          localStorage.setItem('fetsubot_ip_sessions_json', JSON.stringify(registry, null, 2));
        } catch { /* noop */ }

        navigate(`/chat/${uuid}`, { replace: true });
      })
      .catch(() => {
        const fallbackIp = '127.0.0.1';
        const uuid = ipToUuid(fallbackIp);
        navigate(`/chat/${uuid}`, { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#08080C] text-slate-100 flex flex-col items-center justify-center gap-3 font-mono text-sm">
      <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
      <p className="text-slate-400">Memuat Sesi Chat (IP Session UUID)...</p>
    </div>
  );
}

// ── App Router ───────────────────────────────────────────────────────────────
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/chat" element={<ChatRedirect />} />
      <Route path="/chat/:sessionId" element={<ChatPage />} />
    </Routes>
  );
}

export default App;
