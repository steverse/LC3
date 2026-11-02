import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-monaco': ['@monaco-editor/react'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-react': ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
})
