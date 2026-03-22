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
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:18765',
        ws: true,
        changeOrigin: true
      }
    },
    // 支持 SPA 路由
    strictPort: true
  },
  // 构建时也支持 SPA 路由
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
