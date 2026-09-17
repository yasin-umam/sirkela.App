import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Satu entri saja. Luang punya dua (landing + /app/) dan base './' warisan era
// Capacitor; aplikasi ini tidak punya landing, jadi app langsung di root.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
