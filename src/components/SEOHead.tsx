import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
}

export function SEOHead({
  title = "Fetsu Siahaan — Software Engineer • Backend Developer • Solution Architect",
  description = "Halo, Saya Fetsu Siahaan. Saya membantu mengembangkan aplikasi modern, REST API, dan sistem enterprise yang cepat, aman, dan scalable.",
  keywords = "Fetsu Siahaan, Software Engineer, Backend Developer, Solution Architect, REST API, Enterprise System, Digital Transformation, Cyber Red, React, Node.js, Cloud Architecture, AI System",
  canonicalUrl = "https://fetsu.id/",
  ogImage = "https://fetsu.id/og-cover.png",
  ogType = "website",
}: SEOProps) {
  useEffect(() => {
    // 1. Update Title
    document.title = title;

    // Helper to set meta content
    const setMeta = (attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Helper to set link
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Standard Meta
    setMeta('name', 'description', description);
    setMeta('name', 'keywords', keywords);
    setMeta('name', 'author', 'Fetsu Siahaan');
    setMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    // Open Graph Meta
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:site_name', 'Fetsu Siahaan Portfolio & Enterprise Lab');
    setMeta('property', 'og:locale', 'id_ID');

    // Twitter Cards
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);
    setMeta('name', 'twitter:creator', '@fetsusiahaan');

    // Canonical link
    setLink('canonical', canonicalUrl);

    // Dynamic JSON-LD Structured Data Injection
    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": "https://fetsu.id/#person",
          "name": "Fetsu Siahaan",
          "jobTitle": ["Software Engineer", "Backend Developer", "Solution Architect"],
          "url": "https://fetsu.id",
          "sameAs": [
            "https://github.com/fetsusiahaan",
            "https://linkedin.com/in/fetsusiahaan",
            "https://instagram.com/fetsusiahaan"
          ],
          "knowsAbout": [
            "Software Engineering",
            "Backend Development",
            "Cloud Infrastructure",
            "REST APIs",
            "Microservices Architecture",
            "Generative AI Integration",
            "Cyber Security"
          ],
          "description": description
        },
        {
          "@type": "WebSite",
          "@id": "https://fetsu.id/#website",
          "url": "https://fetsu.id",
          "name": "Fetsu Siahaan — Software Engineering Hub",
          "description": description,
          "publisher": { "@id": "https://fetsu.id/#person" },
          "inLanguage": "id-ID"
        },
        {
          "@type": "ProfessionalService",
          "@id": "https://fetsu.id/#service",
          "name": "Fetsu Siahaan Software Architecture Consultancy",
          "url": "https://fetsu.id",
          "provider": { "@id": "https://fetsu.id/#person" },
          "areaServed": "Worldwide",
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Software Engineering Services",
            "itemListElement": [
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "REST API & Backend Development",
                  "description": "High-throughput, enterprise-grade backend infrastructure and microservices."
                }
              },
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "Modern Web Application Architecture",
                  "description": "Responsive, SEO-optimized React & TypeScript applications with modern UI aesthetics."
                }
              },
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "Solution Architecture & Cloud Systems",
                  "description": "Scalable cloud-native system design, containerization, and DevOps pipelines."
                }
              }
            ]
          }
        }
      ]
    };

    let scriptEl = document.querySelector('script[id="jsonld-seo-schema"]');
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.setAttribute('id', 'jsonld-seo-schema');
      scriptEl.setAttribute('type', 'application/ld+json');
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(schemaData, null, 2);
  }, [title, description, keywords, canonicalUrl, ogImage, ogType]);

  return null;
}
