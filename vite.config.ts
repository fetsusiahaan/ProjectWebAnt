import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: ['fetsu.id', 'www.fetsu.id'] ,
    host: '0.0.0.0', // atau true untuk semua host
    port: 5172,
  },
})
