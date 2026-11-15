import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { alias: { "@beak/charts": new URL("./packages/beak-charts/src/index.ts", import.meta.url).pathname } },
  plugins: [react(), tailwindcss()],
})
