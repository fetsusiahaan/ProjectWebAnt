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

import { SEOHead } from './components/SEOHead';

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
      {/* Dynamic SEO Meta & Schema Injection */}
      <SEOHead
        title="Fetsu Siahaan — Software Engineer • Backend Developer • Solution Architect"
        description="Halo, Saya Fetsu Siahaan. Saya membantu mengembangkan aplikasi modern, REST API, dan sistem enterprise yang cepat, aman, dan scalable."
        canonicalUrl="https://fetsu.id/"
      />

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
    const uuid = ipToUuid('127.0.0.1');
    navigate(`/chat/${uuid}`, { replace: true });
  }, [navigate]);

  return null;
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
