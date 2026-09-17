import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { AppProviders } from './context/AppProviders'

// Chunk lama hilang setelah deploy baru (halaman di-lazy load, nama hash berubah):
// reload otomatis sekali per sesi tab, supaya pengguna tidak melihat layar error.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('reload-preload-error')) return
  sessionStorage.setItem('reload-preload-error', '1')
  window.location.reload()
})
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem('reload-preload-error'), 5000)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
)
