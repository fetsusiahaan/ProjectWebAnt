import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // IDU_* joins the default VITE_* prefix so the gateway URL and key reach the
  // browser bundle. This is a pure frontend app: the key IS public — anyone can
  // read it from DevTools. Rotate it if it leaks beyond the intended audience.
  envPrefix: ['VITE_', 'IDU_'],
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: ['fetsu.id', 'www.fetsu.id'],
    host: '0.0.0.0',
    port: 5172,
    hmr: {
      overlay: false,
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor-utils';
          }
        },
      },
    },
  },
})
