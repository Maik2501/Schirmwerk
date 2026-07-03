/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // fester Port für die Vorschau-Tools
    strictPort: true,
  },
  test: {
    // Geometrie-Tests sind reine Mathematik – kein DOM nötig
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
