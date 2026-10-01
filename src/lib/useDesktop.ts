import { useSyncExternalStore } from 'react'

// Sama dengan breakpoint `lg` Tailwind (64rem = 1024px): di atasnya aplikasi
// memakai kerangka desktop (sidebar guru, tabel, panel samping). Ubah keduanya
// bersamaan kalau titiknya digeser -- kelas `lg:` di JSX dan hook ini harus
// selalu sepakat soal "ini desktop atau bukan".
//
// Hook ini dipakai HANYA kalau strukturnya berbeda jauh antara HP dan desktop
// (mis. daftar akordeon vs panel master-detail di Jawaban & nilai). Perbedaan
// ukuran/susunan biasa cukup dengan kelas `lg:`.
const KUERI = '(min-width: 64rem)'

function langgan(panggil: () => void) {
  const m = window.matchMedia(KUERI)
  m.addEventListener('change', panggil)
  return () => m.removeEventListener('change', panggil)
}

export function useDesktop(): boolean {
  return useSyncExternalStore(langgan, () => window.matchMedia(KUERI).matches, () => false)
}
