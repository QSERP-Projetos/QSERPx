import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('react-icons')) {
            return 'icons-vendor'
          }

          if (id.includes('@supabase')) {
            return 'supabase-vendor'
          }

          if (id.includes('react-router')) {
            return 'router-vendor'
          }

          if (id.includes('axios')) {
            return 'axios-vendor'
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
