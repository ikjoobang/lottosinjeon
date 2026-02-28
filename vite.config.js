import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  },
  esbuild: {
    // duplicate key 경고 무시 (CSS-in-JS 패턴, 의도적 오버라이드)
    legalComments: 'none'
  }
})
