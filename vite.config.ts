import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
    watch: {
      ignored: ['**/src-tauri/target/**', '**/node_modules/**', '**/*.exe'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
