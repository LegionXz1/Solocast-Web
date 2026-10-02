import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/widgets': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/socket.io-client/')) {
            return 'vendor-socket';
          }
        }
      }
    }
  }
})
