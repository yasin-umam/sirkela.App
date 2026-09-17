// ─── Auth ───────────────────────────────────────────────────────────────────

export type Role = 'guru' | 'murid'

export interface User {
  id: string
  nama: string
  email: string
  role: Role
}

// ─── Navigasi ───────────────────────────────────────────────────────────────
// Tidak ada router: satu state layar di NavContext. Tab editor guru (Pertanyaan
// · Jawaban · Setelan) hidup di state lokal GuruHome, bukan di sini -- tidak ada
// tautan dalam ke tab mana pun (satu-satunya tautan, ?sesi=KODE, ditangani
// MuridSesiPage).

export type AppScreen =
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'forgotPassword' }
  | { name: 'resetPassword' }
  | { name: 'guru' }
  | { name: 'murid' }

// ─── Soal ───────────────────────────────────────────────────────────────────

/** Soal seperti yang disalin ke konten_list sesi -- LENGKAP dengan kunci. */
export interface HasilSoal {
  id: string
  pertanyaan: string
  pilihan: string[]
  jawabanBenar: number
}

/** Satu formulir = judul + deskripsi + soal berurutan + setelan sesi. */
export interface Formulir {
  id: string
  judul: string
  deskripsi: string
  durasiMenit: number
  kunciLayar: boolean
  /** formId Google Form asal impor terakhir. */
  gformId: string | null
  dibuatPada: string
  diperbaruiPada: string
}

/**
 * Soal di editor formulir. Boleh berupa DRAF -- editor menyimpan tiap ketikan,
 * dan kelengkapan baru ditagih saat sesi dibuka (lihat masalahSoal()).
 */
export interface Soal {
  id: string
  formulirId: string
  pertanyaan: string
  pilihan: string[]
  /** null = kunci belum dipilih. BUKAN 0: "belum dipilih" harus beda dari "opsi pertama". */
  jawabanBenar: number | null
  urutan: number
}

export type IsiSoal = Pick<Soal, 'pertanyaan' | 'pilihan' | 'jawabanBenar'>

// ─── Sesi ───────────────────────────────────────────────────────────────────

/**
 * Konten sesi. Di Luang ada juga materi/modul/lkpd/game; di sini cuma soal.
 * `tipe` tetap disimpan supaya konten_list berbentuk sama dengan Luang dan
 * server (ambil_konten_sesi, selesaikan_murid) bisa terus menyaring per tipe.
 */
export interface KontenItem {
  id: string
  tipe: 'soal'
  judul: string
  /** SALINAN soal (A6), bukan referensi ke bank_soal. */
  data: HasilSoal[]
}

export interface PesertaSesi {
  muridId: string
  nama: string
  /** ISO. Basi > 45 detik = perangkatnya berhenti mengirim sinyal. */
  terakhirDenyut: string | null
  /** Berapa kali meninggalkan layar. Kesaksian untuk guru, bukan hukuman. */
  keluarLayar: number
  /**
   * Berapa kali membuka aplikasi lain tanpa meninggalkan layar (hilang fokus
   * lebih dari toleransi). Dipisah dari keluarLayar: sinyal ini lebih sering
   * menyala tanpa sebab curang.
   */
  hilangFokus: number
  /** ISO. Non-null = sedang terkunci sampai guru membukanya. */
  terkunciPada: string | null
}

export interface SesiKelas {
  id: string
  /** null = formulir asalnya sudah dihapus. Sesinya tetap bisa dibuka lewat salinannya. */
  formulirId: string | null
  judul: string
  deskripsi: string
  durasiMenit: number
  /** ISO dari server, bukan jam perangkat guru (A7). */
  mulaiPada: string | null
  selesaiPada: string | null
  status: 'aktif' | 'selesai'
  kontenList: KontenItem[]
  kodeJoin: string
  kunciLayar: boolean
  muridJoined: PesertaSesi[]
  /** ISO `created_at`. Pembeda dua sesi dari formulir yang sama. */
  dibuatPada: string
}
