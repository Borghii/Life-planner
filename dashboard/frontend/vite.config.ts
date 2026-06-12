import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    react(),
  ],
  // In dev, serve from root '/'. In production build, assets go to '/static/dist/assets/'
  base: command === 'build' ? '/static/dist/' : '/',
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
}))
