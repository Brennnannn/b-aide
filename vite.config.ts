import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { localApi } from './server/api'

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, './src/ui'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
