// ─── Tangkap kode sesi dari link (?sesi=ABC-123) ─────────────────────────────
// Mengetik kode adalah langkah yang paling banyak gagal di ruang kelas: 'O' vs
// '0', huruf tertukar, lalu guru berhenti mengajar untuk mengeja ulang. Jalan
// paling mulus: guru membagikan satu tautan, murid menekannya.
//
// Kodenya dititipkan ke localStorage, BUKAN dibaca langsung dari URL saat
// dibutuhkan: di antara membuka link dan sampai di layar sesi bisa terselip
// login atau pendaftaran, dan proses itu mengganti URL-nya.

const KEY = 'sesi-soal:sesi_pending'

/** Kode sesi hanya A-Z dan 2-9 dengan satu tanda hubung -- lihat generateKodeJoin(). */
function bersihkan(kode: string): string {
  return kode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 7)
}

export function tangkapSesiDariUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const kode = bersihkan(params.get('sesi') ?? '')
    if (kode) {
      localStorage.setItem(KEY, kode)
      // Dibersihkan dari URL supaya kode tidak ikut ter-bookmark atau tersalin
      // ulang lewat address bar setelah murid masuk.
      const url = new URL(window.location.href)
      url.searchParams.delete('sesi')
      window.history.replaceState({}, '', url.toString())
    }
  } catch { /* gagal-senyap: mode privat / storage diblokir */ }
}

export function bacaSesiPending(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function hapusSesiPending() {
  try { localStorage.removeItem(KEY) } catch { /* gagal-senyap */ }
}

export function urlGabungSesi(kode: string): string {
  const dasar = `${window.location.origin}${window.location.pathname}`
  return `${dasar}?sesi=${encodeURIComponent(kode)}`
}

/**
 * Ambil kode sesi dari hasil SCAN QR. Dicoba dua jalur: sebagai URL berisi
 * ?sesi=... (bentuk yang diterbitkan urlGabungSesi), lalu sebagai kode telanjang.
 */
export function ekstrakKodeDariTeks(teks: string): string | null {
  try {
    const url = new URL(teks)
    const dariUrl = bersihkan(url.searchParams.get('sesi') ?? '')
    if (dariUrl) return dariUrl
  } catch { /* bukan URL valid -- coba sebagai kode telanjang di bawah */ }
  const langsung = bersihkan(teks)
  return langsung || null
}
