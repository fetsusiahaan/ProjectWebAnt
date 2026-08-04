import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { About } from './About';
import { TechStack } from './TechStack';
import { ArchitectureShowcase } from './ArchitectureShowcase';
import { Projects } from './Projects';
import { Contact } from './Contact';
import { Footer } from './Footer';
import { FloatingChatButton } from './FloatingChatButton';
import { LoadingScreen } from './LoadingScreen';

export function HomePage() {
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

      {/* Bouncing Ball Loading Screen */}
      <LoadingScreen durationMs={2300} />

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
