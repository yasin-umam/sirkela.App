import { supabase } from './supabase'

/**
 * Cek kode sekolah SEBELUM signUp() -- supaya kode yang salah ditolak di layar
 * Daftar dengan pesan jelas, bukan lewat kegagalan handle_new_user() yang bisa
 * dibungkus GoTrue jadi pesan generik. Mengembalikan nama sekolah kalau valid.
 */
export async function cekKodeSekolah(kode: string): Promise<string | null> {
  // Mode uji tampilan (lib/ujiTampilan.ts): tanpa server, satu kode contoh.
  if (import.meta.env.VITE_UJI_TAMPILAN) return kode.toUpperCase() === 'SMK1-CONTOH' ? 'SMK Negeri 1 Contoh' : null
  const { data, error } = await supabase.rpc('cek_kode_sekolah', { p_kode: kode })
  if (error) return null
  return (data as string | null) ?? null
}

/**
 * Memindahkan guru lama dari "Sekolah Default" ke sekolah berkode itu, SEKALI
 * JALAN (gabung_sekolah() menolak akun yang sudah punya sekolah asli).
 * Mengembalikan nama sekolah, atau pesan galat yang siap tampil.
 */
export async function gabungSekolah(kode: string): Promise<{ nama: string } | { galat: string }> {
  if (import.meta.env.VITE_UJI_TAMPILAN) {
    return kode.toUpperCase() === 'SMK1-CONTOH' ? { nama: 'SMK Negeri 1 Contoh' } : { galat: 'Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolahmu.' }
  }
  const { data, error } = await supabase.rpc('gabung_sekolah', { p_kode: kode })
  if (error) {
    if (/tidak ditemukan/i.test(error.message)) return { galat: 'Kode sekolah tidak ditemukan. Tanyakan ke kepala sekolahmu.' }
    if (/sudah terhubung/i.test(error.message)) return { galat: 'Akunmu sudah terhubung ke sekolah.' }
    // Fungsinya belum dipasang di server (migrasi belum di-push) atau jaringan putus.
    return { galat: 'Gagal menghubungkan akun. Coba lagi.' }
  }
  return { nama: data as string }
}
