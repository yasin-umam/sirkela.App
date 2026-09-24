import { supabase } from './supabase'

/**
 * Cek kode sekolah SEBELUM signUp() -- supaya kode yang salah ditolak di layar
 * Daftar dengan pesan jelas, bukan lewat kegagalan handle_new_user() yang bisa
 * dibungkus GoTrue jadi pesan generik. Mengembalikan nama sekolah kalau valid.
 */
export async function cekKodeSekolah(kode: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('cek_kode_sekolah', { p_kode: kode })
  if (error) return null
  return (data as string | null) ?? null
}
