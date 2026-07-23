import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/tsconfig*.json', '**/node_modules.desktop-backup-*/**'],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'],
    noDiscovery: true,
  },
})
