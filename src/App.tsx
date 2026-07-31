import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

// ── App Router ───────────────────────────────────────────────────────────────
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
}

export default App;
