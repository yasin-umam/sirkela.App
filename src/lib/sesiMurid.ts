import { supabase } from './supabase'
import type { JenisPeristiwa } from './kunciLayar'

// ─── Jam server ──────────────────────────────────────────────────────────────
// Setiap RPC sesi mengembalikan `sekarang_server`. Selisihnya dengan jam lokal
// disimpan sekali lalu dipakai semua hitung mundur -- HP murid yang jamnya
// meleset (atau sengaja dimundurkan supaya ujian terasa lebih panjang) tidak
// menggeser tenggat apa pun.
let offsetMs = 0

function catatWaktuServer(sekarangServer?: string | null) {
  if (!sekarangServer) return
  offsetMs = new Date(sekarangServer).getTime() - Date.now()
}

/** Perkiraan jam server saat ini, dalam epoch ms. */
export function sekarangServerMs(): number {
  return Date.now() + offsetMs
}

// ─── Bentuk data ─────────────────────────────────────────────────────────────

export interface SesiRingkas {
  id: string
  judul: string
  /** Deskripsi formulir asal, untuk kartu kepala ala Google Form. */
  deskripsi: string
  durasiMenit: number
  status: 'aktif' | 'selesai'
  mulaiPada: string | null
  /** null selama guru belum menekan "Mulai Sesi". */
  tenggat: string | null
  jumlahSoal: number
  /** Nilai EFEKTIF dari server (sakelar sesi DAN sakelar darurat global). */
  kunciLayar: boolean
}

/** Soal seperti yang DITERIMA murid — perhatikan: tidak ada `jawabanBenar`. */
export interface SoalSesi {
  id: string
  pertanyaan: string
  pilihan: string[]
}

export interface KontenSesi {
  id: string
  tipe: 'soal'
  judul: string
  data: unknown
}

export interface IsiSesi {
  konten: KontenSesi[]
  /** Jawaban yang sudah tersimpan di server — dipakai memulihkan sesi yang terputus. */
  jawabanTersimpan: Record<string, number>
  /**
   * Sidik jari konten_list saat isi ini diambil. Dibandingkan dengan yang ikut
   * di tiap status_sesi(): begitu berbeda, guru mengubah sesinya dan isi ini
   * sudah basi. Datang dari RPC yang sama dengan kontennya supaya keduanya
   * selalu satu snapshot.
   */
  versiKonten: string
}

export interface HasilSesi {
  nilai: number
  benar: number
  total: number
}

type RpcJson = Record<string, unknown>

function ambil<T>(obj: RpcJson | null, kunci: string, bawaan: T): T {
  const v = obj?.[kunci]
  return (v ?? bawaan) as T
}

// ─── RPC ─────────────────────────────────────────────────────────────────────

export function pesanRamah(pesan: string): string {
  // Pesan dari RAISE di RPC sudah ditulis untuk dibaca murid ("Kode sesi tidak
  // ditemukan", "Waktu sudah habis"). Yang perlu diterjemahkan cuma kegagalan
  // di lapisan bawahnya.
  if (/fetch|network|Failed to send/i.test(pesan)) return 'Tidak ada koneksi. Coba lagi.'
  return pesan
}

export async function gabungSesi(kode: string): Promise<SesiRingkas> {
  const { data, error } = await supabase.rpc('gabung_sesi', { p_kode: kode })
  if (error) throw new Error(pesanRamah(error.message))
  const d = data as RpcJson
  catatWaktuServer(d.sekarang_server as string)
  return {
    id: d.id as string,
    judul: d.judul as string,
    deskripsi: ambil(d, 'deskripsi', ''),
    durasiMenit: d.durasi_menit as number,
    status: d.status as 'aktif' | 'selesai',
    mulaiPada: (d.mulai_pada as string) ?? null,
    tenggat: (d.tenggat as string) ?? null,
    jumlahSoal: ambil(d, 'jumlah_soal', 0),
    kunciLayar: ambil(d, 'kunci_layar', false),
  }
}

export async function statusSesi(sesiId: string) {
  const { data, error } = await supabase.rpc('status_sesi', { p_sesi_id: sesiId })
  if (error) throw new Error(pesanRamah(error.message))
  const d = data as RpcJson
  catatWaktuServer(d.sekarang_server as string)
  return {
    status: d.status as 'aktif' | 'selesai',
    mulaiPada: (d.mulai_pada as string) ?? null,
    tenggat: (d.tenggat as string) ?? null,
    versiKonten: ambil(d, 'versi_konten', ''),
    kunciLayar: ambil(d, 'kunci_layar', false),
    terkunci: ambil(d, 'terkunci', false),
    terkunciPada: ambil<string | null>(d, 'terkunci_pada', null),
  }
}

/**
 * Pembukaan kunci oleh guru sampai SEKETIKA lewat Realtime baris sesi_murid
 * milik murid sendiri (policy sesi_murid_self_select; RLS yang menyaring baris
 * orang lain). Beda dari arah guru -> murid lewat sesi_kelas yang mustahil (A1).
 * Yang dikirim ke pemanggil cuma terkunci_pada; keputusannya tetap diambil dari
 * status_sesi(), karena kunci efektif juga bergantung sakelar sesi & darurat.
 */
export function pantauKunciSaya(sesiId: string, onUbah: (terkunciPada: string | null) => void): () => void {
  const channel = supabase
    .channel(`kunci-saya-${sesiId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'sesi_murid', filter: `sesi_id=eq.${sesiId}`,
    }, payload => {
      onUbah((payload.new as { terkunci_pada?: string | null }).terkunci_pada ?? null)
    })
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

export async function ambilIsiSesi(sesiId: string): Promise<IsiSesi> {
  const { data, error } = await supabase.rpc('ambil_konten_sesi', { p_sesi_id: sesiId })
  if (error) throw new Error(pesanRamah(error.message))
  const d = data as RpcJson
  catatWaktuServer(d.sekarang_server as string)
  return {
    konten: ambil<KontenSesi[]>(d, 'konten', []),
    jawabanTersimpan: ambil<Record<string, number>>(d, 'jawaban_tersimpan', {}),
    versiKonten: ambil(d, 'versi_konten', ''),
  }
}

export async function selesaikanSesi(sesiId: string): Promise<HasilSesi> {
  const { data, error } = await supabase.rpc('selesaikan_murid', { p_sesi_id: sesiId })
  if (error) throw new Error(pesanRamah(error.message))
  const d = data as RpcJson
  return {
    nilai: ambil(d, 'nilai', 0),
    benar: ambil(d, 'benar', 0),
    total: ambil(d, 'total', 0),
  }
}

export async function denyut(sesiId: string): Promise<void> {
  await supabase.rpc('denyut_sesi', { p_sesi_id: sesiId })
}

/**
 * Dipanggil sekali di layar "Siap memulai", sebelum murid masuk ke soal.
 * gabung_sesi() mengisi nama dari akun secara diam-diam saat join -- ini yang
 * membuat murid mengonfirmasi/mengganti sendiri, penting untuk HP/akun yang
 * dipakai bergantian oleh murid berbeda.
 */
export async function setNamaPeserta(sesiId: string, nama: string): Promise<void> {
  const { error } = await supabase.rpc('set_nama_peserta', { p_sesi_id: sesiId, p_nama: nama.trim() })
  if (error) throw new Error(pesanRamah(error.message))
}

// ─── Antrean offline ─────────────────────────────────────────────────────────
// Jawaban dan peristiwa yang gagal terkirim (sinyal putus, tab dibunuh OS)
// disimpan lokal lalu dikirim ulang saat tersambung. Autosave yang hilang begitu
// wifi sekolah goyang bukan autosave.
//
// Kuncinya per-sesi + per-soal: menyimpan ulang soal yang sama menimpa antrean
// lamanya, tidak menumpuk -- cermin PK gabungan jawaban_sesi di DB.

interface Antrean {
  jawaban: Record<string, number>
  peristiwa: { jenis: string; pada: number }[]
}

const kunciAntrean = (sesiId: string) => `sesi-antrean-${sesiId}`

function bacaAntrean(sesiId: string): Antrean {
  try {
    const raw = localStorage.getItem(kunciAntrean(sesiId))
    if (raw) return JSON.parse(raw) as Antrean
  } catch { /* storage penuh / mode privat -- jatuh ke antrean kosong */ }
  return { jawaban: {}, peristiwa: [] }
}

function tulisAntrean(sesiId: string, a: Antrean) {
  try { localStorage.setItem(kunciAntrean(sesiId), JSON.stringify(a)) } catch { /* abaikan */ }
}

export function bersihkanAntrean(sesiId: string) {
  try { localStorage.removeItem(kunciAntrean(sesiId)) } catch { /* abaikan */ }
}

/** Jawaban tersimpan lokal lebih dulu, baru dicoba kirim. */
export async function simpanJawaban(sesiId: string, soalId: string, jawaban: number): Promise<boolean> {
  const antrean = bacaAntrean(sesiId)
  antrean.jawaban[soalId] = jawaban
  tulisAntrean(sesiId, antrean)

  const { error } = await supabase.rpc('simpan_jawaban', {
    p_sesi_id: sesiId, p_soal_id: soalId, p_jawaban: jawaban,
  })
  if (error) return false

  const sesudah = bacaAntrean(sesiId)
  // Hapus dari antrean HANYA kalau nilainya belum berubah lagi selama request
  // berlangsung -- kalau murid keburu mengganti pilihannya, biarkan tetap antre.
  if (sesudah.jawaban[soalId] === jawaban) {
    delete sesudah.jawaban[soalId]
    tulisAntrean(sesiId, sesudah)
  }
  return true
}

/** Masih ada peristiwa yang belum sampai ke server (offline, tab dibekukan OS). */
export function adaPeristiwaTertunda(sesiId: string): boolean {
  return bacaAntrean(sesiId).peristiwa.length > 0
}

export async function catatPeristiwa(sesiId: string, jenis: JenisPeristiwa): Promise<void> {
  const { error } = await supabase.rpc('catat_peristiwa', { p_sesi_id: sesiId, p_jenis: jenis })
  if (!error) return
  const antrean = bacaAntrean(sesiId)
  antrean.peristiwa.push({ jenis, pada: sekarangServerMs() })
  tulisAntrean(sesiId, antrean)
}

/** Kirim ulang semua yang tertahan. Dipanggil saat online kembali & tiap denyut. */
export async function kirimAntrean(sesiId: string): Promise<void> {
  const antrean = bacaAntrean(sesiId)
  const adaJawaban = Object.keys(antrean.jawaban).length > 0
  if (!adaJawaban && antrean.peristiwa.length === 0) return

  for (const [soalId, jawaban] of Object.entries(antrean.jawaban)) {
    await simpanJawaban(sesiId, soalId, jawaban)
  }
  // Peristiwa dikirim tanpa stempel waktu aslinya: catat_peristiwa memakai now()
  // server. Menerima stempel dari klien berarti mempercayai jam perangkat yang
  // justru sedang diawasi.
  //
  // K6: jawaban di atas SENGAJA dikirim lebih dulu. Peristiwa `tinggalkan_layar`
  // bisa melahirkan kunci, dan simpan_jawaban menolak murid yang terkunci --
  // urutan terbalik = jawaban yang dipilih sebelum murid keluar ikut tertolak.
  const sisa = bacaAntrean(sesiId)
  const peristiwa = sisa.peristiwa
  sisa.peristiwa = []
  tulisAntrean(sesiId, sisa)
  for (const p of peristiwa) {
    await catatPeristiwa(sesiId, p.jenis as JenisPeristiwa)
  }
}

/**
 * Semua soal dari seluruh konten, diratakan jadi satu daftar, DENGAN id yang
 * sama dibuang setelah kemunculan pertama.
 *
 * Grup soal yang tidak sengaja ditambahkan dua kali membuat soal yang sama muncul
 * dua kali, dan kedua salinannya berbagi satu jawaban (dikunci per soalId) --
 * menjawab yang atas diam-diam ikut mengisi yang bawah. Penilaian di server
 * tidak terpengaruh: duplikat menggandakan pembilang sekaligus penyebutnya.
 */
export function ratakanSoal(konten: KontenSesi[]): SoalSesi[] {
  const terlihat = new Set<string>()
  return konten
    .filter(k => k.tipe === 'soal' && Array.isArray(k.data))
    .flatMap(k => k.data as SoalSesi[])
    .filter(s => {
      if (!s?.id || terlihat.has(s.id)) return false
      terlihat.add(s.id)
      return true
    })
}
