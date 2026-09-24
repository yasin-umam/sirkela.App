// ─── Auth ───────────────────────────────────────────────────────────────────

export type Role = 'guru' | 'murid' | 'kepala_sekolah'

export interface User {
  id: string
  nama: string
  email: string
  role: Role
}

// ─── Pengajuan Kepala Sekolah ─────────────────────────────────────────────────
// Swadaya: guru mengajukan diri (tab Saya), admin TUNGGAL (dicek dari email di
// auth.users, lihat adalah_admin_utama()) menyetujui/menolak lewat layar admin
// minimal. Promosi manual lewat SQL editor tetap ada sebagai jalur cadangan.

/** Status pengajuan MILIK SENDIRI, dibaca guru langsung dari tabelnya (RLS). */
export interface StatusPengajuanKepsek {
  status: 'menunggu' | 'disetujui' | 'ditolak'
  dibuatPada: string
}

/** Satu sekolah, dari sudut pandang admin (`ambil_semua_sekolah()`). */
export interface SekolahAdmin {
  id: string
  nama: string
  kodeSekolah: string
  dibuatPada: string
  jumlahGuru: number
}

/** Bentuk lengkap untuk layar admin, dirakit RPC ambil_pengajuan_kepsek(). */
export interface PengajuanKepsek {
  id: string
  guruId: string
  guruNama: string
  sekolahId: string
  sekolahNama: string
  status: 'menunggu' | 'disetujui' | 'ditolak'
  dibuatPada: string
  diputuskanPada: string | null
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
  kelas: string
  mapel: string
  durasiMenit: number
  kunciLayar: boolean
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
  /**
   * Non-null = sesi ini lahir dari mulai_super_sesi(), bukan dari Kirim milik
   * pengawas sendiri (SS2/SS3 -- lihat migrasi super_sesi). guru_id sudah
   * berupa pengawas, jadi baris ini tidak beda dari sesi biasa selain dua
   * field ini.
   */
  superSesiId: string | null
  superSesiJudul: string | null
}

// ─── Super Sesi ─────────────────────────────────────────────────────────────
// Ulangan lintas guru: kepala sekolah mengumpulkan kiriman dari beberapa guru
// mapel jadi satu Super Sesi, menugaskan pengawas per kiriman, lalu satu aksi
// "Mulai" mendistribusikannya jadi sesi_kelas biasa milik masing-masing
// pengawas. Lihat CLAUDE.md & supabase/migrations/20260924100000_super_sesi.sql.

export interface SuperSesi {
  id: string
  judul: string
  deskripsi: string
  status: 'mengumpulkan' | 'berjalan' | 'selesai'
  mulaiPada: string | null
  dibuatPada: string
}

/** Bentuk ringkas dipakai DialogKirim untuk memilih tujuan kirim. */
export type SuperSesiRingkas = Pick<SuperSesi, 'id' | 'judul' | 'deskripsi'>

/**
 * Satu murid di satu kiriman, dari sudut pandang kepala sekolah -- laporan
 * yang sama dengan PesertaSesi yang dilihat pengawas (keluarLayar/hilangFokus
 * adalah KESAKSIAN, bukan tuduhan, A4 tetap berlaku), plus wewenang buka
 * kunci untuk sesi Super Sesi kini ADA DI SINI, bukan di sisi pengawas.
 */
export interface MuridSuperSesi {
  muridId: string
  nama: string
  terkunciPada: string | null
  terakhirDenyut: string | null
  keluarLayar: number
  hilangFokus: number
}

/**
 * Satu kelas hasil distribusi Super Sesi yang BELUM diklaim guru mana pun --
 * daftar ini metadata SAJA (TANPA konten_list/kunci jawaban, lihat SS8 di
 * migrasi 20260925000000_klaim_kelas_super_sesi.sql), dilihat SEMUA guru di
 * sekolah yang sama lewat ambil_kelas_tersedia_super_sesi(). Begitu diklaim
 * (klaimKelasSuper di SesiContext), baris ini lenyap dari sini dan muncul
 * sebagai SesiKelas biasa di semuaSesi.
 */
export interface KelasSuperSesiTersedia {
  sesiId: string
  mapel: string
  kelas: string
  judul: string
  superSesiJudul: string
  durasiMenit: number
  dibuatPada: string
}

/** Satu kiriman formulir di dalam satu Super Sesi, dari sudut pandang kepala sekolah. */
export interface SubmisiSuperSesi {
  id: string
  mapel: string
  kelas: string
  judul: string
  guruMapelNama: string
  pengawasId: string | null
  pengawasNama: string | null
  sesiId: string | null
  kodeJoin: string | null
  sesiStatus: 'aktif' | 'selesai' | null
  mulaiPadaSesi: string | null
  kunciLayar: boolean
  jumlahMurid: number
  murid: MuridSuperSesi[]
}
