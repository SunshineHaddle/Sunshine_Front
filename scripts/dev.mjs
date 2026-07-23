import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

const hotReloadEnabled = process.argv.includes('--hmr')

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    hmr: hotReloadEnabled,
    watch: {
      ignored: [
        '**/tsconfig*.json',
        '**/vite.config.*',
        '**/* 2.css',
        '**/node_modules.desktop-backup-*/**',
      ],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'],
    noDiscovery: true,
  },
})

await server.listen()
server.printUrls()
server.config.logger.info(
  hotReloadEnabled
    ? '자동 새로고침: 사용'
    : '자동 새로고침: 사용 안 함 (최신 화면은 브라우저에서 직접 새로고침)',
)
server.bindCLIShortcuts({ print: true })
