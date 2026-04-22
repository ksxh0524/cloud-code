import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 18766,
    proxy: {
      '/api': {
        target: 'http://localhost:18765',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:18765',
        ws: true,
      },
    },
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    sourcemap: 'hidden',
  },
})
