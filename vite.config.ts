import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@beak/charts': path.resolve(__dirname, 'packages/beak-charts/src/index.ts'),
      '@beak/charts/react': path.resolve(__dirname, 'packages/beak-charts/src/react/index.ts'),
    },
  },
})
