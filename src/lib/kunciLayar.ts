import { useEffect, useRef } from 'react'

// ─── Kunci Layar Sesi — sisi klien ───────────────────────────────────────────
// Yang ada di berkas ini cuma SENSOR dan PENGUNCI PERANGKAT. Keputusan mengunci
// seorang murid tidak pernah dibuat di sini: tiap kejadian dilaporkan lewat
// catat_peristiwa(), dan server yang memutuskan (K5). Layar murid memang
// mengunci dirinya SEKETIKA begitu sensor pengunci menyala, tapi itu cuma
// supaya kunci tidak menunggu jaringan -- status server tetap yang menang.
//
// Beda dari Luang: jembatan ke aplikasi native Luang Sesi (window.LuangSesi,
// screen pinning, event 'luang-sesi') dibuang. Aplikasi itu memuat luang.online,
// jadi tidak akan pernah menjalankan aplikasi ini.

/** Hilang fokus sesingkat ini tidak dilaporkan: melirik panel notifikasi masih lolos. */
export const TOLERANSI_FOKUS_MS = 2500

export type JenisPeristiwa =
  | 'tinggalkan_layar' | 'kembali_layar'
  | 'hilang_fokus' | 'kembali_fokus'
  | 'keluar_layar_penuh'

/**
 * CERMIN daftar pengunci di catat_peristiwa() (supabase/migrations). Ubah
 * keduanya bersamaan -- kalau menyimpang, layar murid terkunci untuk kejadian
 * yang tidak pernah dikunci server (lalu terbuka sendiri 20 detik kemudian),
 * atau sebaliknya.
 *
 * `keluar_layar_penuh` sengaja TIDAK ada: di fullscreen, tombol Back pertama-
 * tama hanya keluar dari fullscreen, dan murid yang tidak sengaja menekannya
 * tidak boleh terkunci.
 */
export const JENIS_PENGUNCI: ReadonlySet<JenisPeristiwa> = new Set<JenisPeristiwa>([
  'tinggalkan_layar', 'hilang_fokus',
])

// ─── Layar penuh ─────────────────────────────────────────────────────────────

// Sekali ditolak, tidak diminta lagi selama halaman ini hidup. Browser bawaan di
// dalam aplikasi lain (WebView) umumnya melaporkan fullscreenEnabled = true
// tapi menolak permintaannya -- tanpa penanda ini pita "Aktifkan" tampil terus
// dan tombolnya tidak pernah berbuat apa-apa. Level modul, bukan state
// komponen: penolakan pertama biasanya terjadi di layar "Siap memulai",
// sebelum KerjakanSesi (yang menampilkan pita) ter-mount.
let layarPenuhDitolak = false

export function bisaLayarPenuh(): boolean {
  return !!document.fullscreenEnabled && !layarPenuhDitolak
}

/**
 * WAJIB dipanggil SINKRON di dalam handler ketukan -- Fullscreen API butuh
 * gestur. Penolakannya disiarkan sebagai `fullscreenerror` di document supaya
 * layar yang sudah ter-mount bisa ikut menyembunyikan pita.
 */
export function mintaLayarPenuh(): void {
  if (!bisaLayarPenuh() || document.fullscreenElement) return
  try {
    void document.documentElement.requestFullscreen().catch(() => {
      if (layarPenuhDitolak) return
      layarPenuhDitolak = true
      document.dispatchEvent(new Event('fullscreenerror'))
    })
  } catch {
    layarPenuhDitolak = true
  }
}

function keluarLayarPenuh(): void {
  if (!document.fullscreenElement) return
  try {
    void document.exitFullscreen().catch(() => { /* sudah keluar */ })
  } catch { /* tidak didukung */ }
}

// ─── Sensor ──────────────────────────────────────────────────────────────────

/**
 * Memasang sensor selama `aktif` (fase pengerjaan). Berlaku untuk SEMUA sesi --
 * di sesi tanpa kunci, hasilnya kesaksian saja.
 */
export function useSensorSesi({ aktif, kunciLayar, onPeristiwa }: {
  aktif: boolean
  kunciLayar: boolean
  onPeristiwa: (jenis: JenisPeristiwa) => void
}): void {
  const cbRef = useRef(onPeristiwa)
  cbRef.current = onPeristiwa
  const kunciRef = useRef(kunciLayar)
  kunciRef.current = kunciLayar

  useEffect(() => {
    if (!aktif) return
    const lapor = (j: JenisPeristiwa) => cbRef.current(j)
    let timerFokus: number | null = null
    let hilangFokusTerlapor = false

    function batalTimerFokus() {
      if (timerFokus !== null) { window.clearTimeout(timerFokus); timerFokus = null }
    }

    function onVisibility() {
      // Keluar aplikasi memicu `blur` DAN `visibilitychange`. Satu kepergian
      // dicatat satu kali: sebagai tinggalkan_layar, bukan juga hilang_fokus.
      batalTimerFokus()
      lapor(document.hidden ? 'tinggalkan_layar' : 'kembali_layar')
    }

    function onBlur() {
      if (document.hidden) return
      batalTimerFokus()
      // Timer, BUKAN dihitung saat fokus kembali: dalam split-screen halaman
      // tetap terlihat, sedangkan murid yang tidak pernah kembali ke aplikasi
      // tidak akan pernah memicu `focus`.
      timerFokus = window.setTimeout(() => {
        timerFokus = null
        if (document.hidden || document.hasFocus()) return
        hilangFokusTerlapor = true
        lapor('hilang_fokus')
      }, TOLERANSI_FOKUS_MS)
    }

    function onFocus() {
      batalTimerFokus()
      if (hilangFokusTerlapor) {
        hilangFokusTerlapor = false
        lapor('kembali_fokus')
      }
    }

    function onFullscreen() {
      if (!document.fullscreenElement && kunciRef.current) lapor('keluar_layar_penuh')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      batalTimerFokus()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [aktif])
}

// ─── Pengunci perangkat ──────────────────────────────────────────────────────

/**
 * Selama `aktif` (sesi berkunci + fase pengerjaan): Screen Wake Lock, supaya
 * layar yang mati sendiri saat membaca soal panjang tidak tercatat sebagai
 * `tinggalkan_layar` palsu. Dilepas begitu tidak aktif lagi, sekaligus keluar
 * dari fullscreen. Fullscreen TIDAK diminta di sini: butuh gestur, jadi
 * dipanggil dari tombol Mulai / Mengerti / Aktifkan.
 */
export function usePengunciPerangkat(aktif: boolean): void {
  useEffect(() => {
    if (!aktif) return
    let wake: WakeLockSentinel | null = null
    let batal = false
    async function mintaWake() {
      if (batal || document.hidden || !('wakeLock' in navigator)) return
      try {
        const w = await navigator.wakeLock.request('screen')
        if (batal) void w.release().catch(() => {})
        else wake = w
      } catch { /* baterai hemat daya, atau tidak didukung */ }
    }
    // Browser melepas wake lock tiap halaman tersembunyi.
    function onVisibility() { if (!document.hidden) void mintaWake() }

    void mintaWake()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      batal = true
      document.removeEventListener('visibilitychange', onVisibility)
      void wake?.release().catch(() => {})
      keluarLayarPenuh()
    }
  }, [aktif])
}
