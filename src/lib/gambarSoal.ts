import { supabase } from './supabase'
import { buatUuid } from './soal'

// ─── Gambar di soal ──────────────────────────────────────────────────────────
// Satu soal boleh membawa satu gambar. Berkasnya di Supabase Storage (bucket
// `gambar-soal`, lihat migrasi 20261006000000_gambar_soal.sql); soalnya hanya
// menyimpan PATH-nya (`<id guru>/<uuid>.jpg`), dan URL dirakit di klien.
//
// Unggahan TAK BERUBAH dan TAK PERNAH dihapus (G1): sesi memegang salinan soal
// (A6), path ikut tersalin, jadi berkas yang dihapus/ditimpa merusak sesi yang
// sedang atau sudah berjalan. Mengganti/membuang gambar di editor cuma mengubah
// path di soalnya.

const BUCKET = 'gambar-soal'

/** Berkas mentah dari kamera HP bisa belasan MB; lebih dari ini ditolak sebelum dibaca. */
const MAKS_BYTE_ASAL = 20 * 1024 * 1024
/** Cermin `file_size_limit` bucket -- batas keras, bukan sasaran. */
const MAKS_BYTE_HASIL = 2 * 1024 * 1024
/**
 * Sasaran ukuran: satu kelas membuka gambar yang sama lewat satu wifi sekolah.
 * Kualitas diturunkan bertahap sampai di bawah ini; diagram/tulisan hampir selalu
 * sudah lolos di kualitas pertama, foto berisik yang turun.
 */
const SASARAN_BYTE = 900 * 1024
const MUTU_JPEG = [0.88, 0.78, 0.68, 0.58]
/** Sisi terpanjang. Cukup tajam untuk diagram & tulisan di layar HP. */
const SISI_MAKS = 1600

async function enkodeJpeg(kanvas: HTMLCanvasElement, mutu: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>(res => kanvas.toBlob(res, 'image/jpeg', mutu))
  if (!blob) throw new Error('Gambar gagal diproses.')
  return blob
}

/**
 * Selalu JPEG berlatar putih: satu bentuk keluaran berarti satu ekstensi di path
 * (dijaga CHECK di database), tidak bergantung dukungan encoder WebP tiap browser
 * (Safari diam-diam jatuh ke PNG), dan langsung bisa masuk berkas .docx.
 */
export async function kecilkanGambar(berkas: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(berkas)
  } catch {
    throw new Error('Gambar tidak bisa dibaca. Coba berkas JPG atau PNG.')
  }
  try {
    const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height))
    const lebar = Math.max(1, Math.round(bitmap.width * skala))
    const tinggi = Math.max(1, Math.round(bitmap.height * skala))
    const kanvas = document.createElement('canvas')
    kanvas.width = lebar
    kanvas.height = tinggi
    const ctx = kanvas.getContext('2d')
    if (!ctx) throw new Error('Browser ini tidak bisa memproses gambar.')
    // PNG transparan jadi hitam kalau tidak dialasi putih dulu.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, lebar, tinggi)
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi)
    let hasil = await enkodeJpeg(kanvas, MUTU_JPEG[0])
    for (const mutu of MUTU_JPEG.slice(1)) {
      if (hasil.size <= SASARAN_BYTE) break
      hasil = await enkodeJpeg(kanvas, mutu)
    }
    if (hasil.size > MAKS_BYTE_HASIL) throw new Error('Gambar masih terlalu besar setelah dikecilkan.')
    return hasil
  } finally {
    bitmap.close()
  }
}

function pesanUnggah(pesan: string): string {
  if (/fetch|network|Failed to send/i.test(pesan)) return 'Tidak ada koneksi. Coba lagi.'
  if (/bucket not found/i.test(pesan)) return 'Penyimpanan gambar belum disiapkan di server.'
  if (/row-level security|unauthorized|not allowed/i.test(pesan)) return 'Akunmu tidak boleh mengunggah gambar.'
  return pesan
}

/** Mengecilkan lalu mengunggah. Mengembalikan path untuk disimpan di soal. */
export async function unggahGambarSoal(berkas: Blob): Promise<string> {
  if (berkas.size > MAKS_BYTE_ASAL) throw new Error('Gambar terlalu besar (maksimal 20 MB).')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi login habis. Masuk lagi lalu coba ulang.')

  const jpeg = await kecilkanGambar(berkas)
  // Folder = id guru: policy storage (G2) menolak folder milik orang lain.
  const path = `${session.user.id}/${buatUuid()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    // Berkas tak pernah berubah (G1), jadi boleh di-cache selamanya: satu gambar
    // diunduh sekali per perangkat, bukan sekali per soal yang dibuka ulang.
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(pesanUnggah(error.message))
  return path
}

export function urlGambarSoal(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ─── Unggahan yang sedang berjalan ───────────────────────────────────────────
// Simpan/Kirim yang ditekan sementara gambar masih naik akan menulis soal TANPA
// gambarnya, dan sesi terbuka tanpa gambar itu. Penyimpanan menunggu semua yang
// tercatat di sini (lihat FormulirContext.lakukanSimpan).

const berjalan = new Set<Promise<void>>()

/** Mencatat satu unggahan (termasuk menempelkan path-nya ke soal) sampai selesai atau gagal. */
export function catatUnggahan<T>(kerja: Promise<T>): Promise<T> {
  const jejak: Promise<void> = kerja.then(() => {}, () => {}).finally(() => { berjalan.delete(jejak) })
  berjalan.add(jejak)
  return kerja
}

export async function tungguUnggahan(): Promise<void> {
  while (berjalan.size > 0) await Promise.all([...berjalan])
}
