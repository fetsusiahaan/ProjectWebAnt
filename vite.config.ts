import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { ProxyOptions } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read but never expose: loadEnv runs in Node, so the key stays on this side
  // and is attached by the proxy below. It is deliberately NOT reachable through
  // import.meta.env — see the envPrefix note.
  const env = loadEnv(mode, process.cwd(), 'IDU_')
  const upstream = (env.IDU_ENDPOINT || 'https://ai.intidatautama.com/v1').replace(/\/+$/, '')

  /**
   * Reverse proxy for the AI gateway. This server is what Cloudflare Tunnel
   * exposes as fetsu.id, so /api/ai is same-origin for the browser. That matters
   * twice over:
   *
   *  - Inside the intidatautama network, split-horizon DNS resolves the gateway
   *    to 172.16.0.2 (RFC1918). A public page reaching a private address makes
   *    Chrome prompt the visitor for Local Network Access. Going through this
   *    origin means the browser never sees that address. No CORS header can fix
   *    this — Chrome dropped the server opt-in in favour of a user permission.
   *  - The key is attached here, so it never reaches the bundle.
   *
   * Same-origin also means no preflight, which is why the client no longer needs
   * the key on the query string.
   */
  const aiProxy: Record<string, ProxyOptions> = {
    '/api/ai': {
      target: upstream,
      changeOrigin: true,
      // SSE must not be buffered, or streamed replies arrive all at once.
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (env.IDU_API_KEY) proxyReq.setHeader('Authorization', `Bearer ${env.IDU_API_KEY}`)
          proxyReq.setHeader('Accept-Encoding', 'identity')
        })
      },
      rewrite: (p) => p.replace(/^\/api\/ai/, ''),
    },
  }

  return {
  // IDU_* joins the default VITE_* prefix, but only IDU_PROXY is ever read from
  // import.meta.env. IDU_API_KEY is used by the proxy above and stays in Node —
  // it is not in the bundle, and must not be put there.
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
    proxy: aiProxy,
  },
  // `vite preview` serves dist/; the proxy is repeated so a switch to preview
  // does not silently drop the API route.
  preview: {
    allowedHosts: ['fetsu.id', 'www.fetsu.id'],
    proxy: aiProxy,
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
  }
})
