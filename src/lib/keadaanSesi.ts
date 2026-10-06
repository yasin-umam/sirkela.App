import type { PesertaSesi, SesiKelas } from '../types'
import type { WarnaBadge } from '../components/ui/Badge'

// ─── Keadaan sesi & murid, dihitung di satu tempat ───────────────────────────
// Dipakai layar Sesi (penyaring & baris peserta), Menu (meter di konsol sesi),
// dan bilah atas desktop (jumlah terkunci). "Terkunci" dan "senyap" tidak boleh
// punya dua definisi: angka di konsol Menu harus sama dengan yang dilihat guru
// begitu ia membuka layar Sesi.

/** Dua kali jarak denyut murid (20 detik): lewat ini perangkatnya dianggap berhenti mengirim sinyal. */
export const AMBANG_SENYAP_MS = 45_000

export function statusSesi(s: SesiKelas): { label: string; warna: WarnaBadge } {
  if (s.status === 'selesai') return { label: 'Selesai', warna: 'slate' }
  if (s.mulaiPada) return { label: 'Berjalan', warna: 'hijau' }
  return { label: 'Menunggu', warna: 'slate' }
}

/** Keadaan satu murid saat INI. */
export function keadaanPeserta(p: PesertaSesi, sesi: SesiKelas) {
  const aktif = sesi.status === 'aktif'
  // Kunci efektif = sesi masih berkunci. Mematikan sakelar membebaskan murid
  // walau barisnya belum tersiar ulang.
  const terkunci = aktif && sesi.kunciLayar && p.terkunciPada !== null
  const denyutMs = p.terakhirDenyut ? new Date(p.terakhirDenyut).getTime() : 0
  const senyap = !denyutMs || Date.now() - denyutMs > AMBANG_SENYAP_MS
  return { aktif, terkunci, denyutMs, senyap }
}

/** Yang terkunci dulu -- guru sedang ditunggu mereka. Sisanya urutan bergabung. */
export function urutkanPeserta(sesi: SesiKelas): PesertaSesi[] {
  if (!sesi.kunciLayar) return sesi.muridJoined
  return [...sesi.muridJoined].sort((a, b) => Number(b.terkunciPada !== null) - Number(a.terkunciPada !== null))
}

/** Hitungan murid untuk meter: bergabung = terkunci + senyap + mengerjakan. */
export function hitungPeserta(sesi: SesiKelas) {
  let terkunci = 0
  let senyap = 0
  for (const p of sesi.muridJoined) {
    const k = keadaanPeserta(p, sesi)
    if (k.terkunci) terkunci++
    else if (k.aktif && k.senyap) senyap++
  }
  const bergabung = sesi.muridJoined.length
  return { bergabung, terkunci, senyap, mengerjakan: bergabung - terkunci - senyap }
}

/** 102_000 ms -> "1:42"; di bawah semenit -> "35 dtk". */
export function durasiSingkat(ms: number): string {
  const detik = Math.max(0, Math.round(ms / 1000))
  const menit = Math.floor(detik / 60)
  return menit > 0 ? `${menit}:${String(detik % 60).padStart(2, '0')}` : `${detik} dtk`
}

/** "2× keluar layar · 1× aplikasi lain": kesaksian untuk guru, bukan tuduhan (A4). */
export function sinyalPeserta(p: { keluarLayar: number; hilangFokus: number }): string {
  return [
    p.keluarLayar > 0 && `${p.keluarLayar}× keluar layar`,
    p.hilangFokus > 0 && `${p.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')
}
