import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api/typo3': {
        target: 'https://get.typo3.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/typo3/, '/api/v1')
      }
    }
  }
})
