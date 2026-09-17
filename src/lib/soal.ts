import type { IsiSoal } from '../types'

/** Batas MENAMBAH opsi di editor. Soal impor yang punya lebih tetap tampil utuh. */
export const MAKS_PILIHAN = 10

/**
 * Cermin pemeriksaan di buka_sesi_formulir() -- URUTAN & kalimatnya sama, supaya
 * yang ditandai di editor persis yang nanti ditolak server. null = siap dipakai.
 */
export function masalahSoal(s: IsiSoal): string | null {
  if (!s.pertanyaan.trim()) return 'pertanyaan masih kosong'
  if (s.pilihan.length < 2) return 'butuh minimal 2 opsi'
  if (s.pilihan.some(p => !p.trim())) return 'ada opsi yang masih kosong'
  if (s.jawabanBenar === null) return 'kunci jawaban belum dipilih'
  return null
}

/**
 * Id soal dibuat di KLIEN supaya soal baru langsung bisa diketik sebelum insert-
 * nya sampai. crypto.randomUUID butuh secure context -- dev server http di LAN
 * tidak punya itu, jadi ada cadangan v4 dari Math.random (kolomnya uuid, bentuk
 * harus sah; keunikan cukup untuk skala satu guru).
 */
export function buatUuid(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.random() * 16 | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function labelWaktu(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const kemarin = new Date(todayStart.getTime() - 86_400_000)
  const mingguLalu = new Date(todayStart.getTime() - 6 * 86_400_000)
  if (d >= todayStart) return 'Hari ini'
  if (d >= kemarin) return 'Kemarin'
  if (d >= mingguLalu) return 'Minggu ini'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
}

export function jamMenit(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
