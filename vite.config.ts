import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build also works when served from a /<slug>/ subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { open: true },
})
