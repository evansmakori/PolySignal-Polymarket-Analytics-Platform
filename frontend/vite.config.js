import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// `base` is configurable so the same repo builds for either host:
//   Cloudflare Pages (root serving)  -> no VITE_BASE set  -> base '/'
//   GitHub Pages (project subpath)   -> VITE_BASE=/reponame/ in the build env
const basePath = process.env.VITE_BASE || '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
