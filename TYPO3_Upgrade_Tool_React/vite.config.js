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
      },
      '/api/packagist': {
        target: 'https://repo.packagist.org',
        changeOrigin: true,
        rewrite: (path) => {
          const packageName = path.replace('/api/packagist/', '');
          return `/p2/${packageName}.json`;
        },
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          });
        }
      }
    }
  }
})
