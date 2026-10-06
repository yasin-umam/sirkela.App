import type { Formulir, IsiSoal } from '../types'

/** Batas MENAMBAH opsi di editor. Soal impor yang punya lebih tetap tampil utuh. */
export const MAKS_PILIHAN = 10

export const JUDUL_BAWAAN = 'Formulir tanpa judul'

/**
 * Saran isian Jurusan di editor (SMA lalu SMK) -- cuma saran lewat <datalist>,
 * kolomnya tetap teks bebas karena kompetensi keahlian tiap SMK berbeda-beda.
 */
export const JURUSAN_UMUM = [
  'IPA', 'IPS', 'Bahasa',
  'TKJ', 'RPL', 'Multimedia', 'Akuntansi', 'Perkantoran', 'Pemasaran', 'TKR', 'TBSM',
]

/** "XI · TKJ": kelas + jurusan (kalau ada) jadi satu keterangan. Kosong = kedua-duanya kosong. */
export function kelasJurusan(kelas: string, jurusan = ''): string {
  return [kelas, jurusan].map(x => x.trim()).filter(Boolean).join(' · ')
}

/**
 * Kelas ini jenjang SMA/SMK/MA (kelas X, XI, XII atau 10-12), tempat jurusan
 * WAJIB diisi. Formulir tidak punya kolom jenjang dan sekolah juga tidak, jadi
 * jenjangnya dibaca dari kelas yang diketik guru: X, XI, XII hanya ada di sana
 * (SD kelas 1-6, SMP VII-IX). "IX" tidak ikut karena polanya dimulai dari awal teks;
 * "100" tidak ikut karena tidak boleh disusul angka. Awalan "Kelas" dibolehkan.
 * Kelas yang ditulis tidak lazim (mis. "sebelas") lolos tanpa tagihan: aturannya
 * menagih yang pasti SMA/SMK, bukan menebak sisanya.
 */
export function kelasButuhJurusan(kelas: string): boolean {
  return /^(?:kelas\s*)?(?:XII|XI|X|12|11|10)(?![0-9])/i.test(kelas.trim())
}

/**
 * Judul/kelas/mapel wajib diisi SEBELUM Simpan (permintaan pemilik produk,
 * 2026-09-23) -- beda dari masalahSoal() yang cuma menagih kelengkapan di
 * pintu Kirim. "Formulir tanpa judul" (bawaan formulir baru) dihitung SAMA
 * dengan kosong: kalau tidak, aturan ini tidak pernah benar-benar menagih apa
 * pun karena kolomnya memang tidak pernah null/"".
 * Jurusan ditagih HANYA untuk kelas SMA/SMK (kelasButuhJurusan); SD dan SMP
 * tidak punya jurusan. Permintaan pemilik produk, 2026-10-06.
 */
export function masalahFormulir(f: Pick<Formulir, 'judul' | 'kelas' | 'jurusan' | 'mapel'>): string | null {
  if (!f.judul.trim() || f.judul.trim() === JUDUL_BAWAAN) return 'judul belum diisi'
  if (!f.kelas.trim()) return 'kelas belum diisi'
  if (kelasButuhJurusan(f.kelas) && !f.jurusan.trim()) return 'jurusan belum diisi'
  if (!f.mapel.trim()) return 'mapel belum diisi'
  return null
}

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

/** "Hari ini, 09:12" / "Kemarin, 14:30" / "Minggu ini" / "6 Oktober": untuk sel tabel desktop. */
export function waktuRingkas(iso: string): string {
  const l = labelWaktu(iso)
  return l === 'Hari ini' || l === 'Kemarin' ? `${l}, ${jamMenit(iso)}` : l
}

/** "12 September 2026". */
export function tanggalLengkap(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
