import { supabase } from './supabase'
import type { PengajuanKepsek, SekolahAdmin, StatusPengajuanKepsek } from '../types'

/**
 * Satu-satunya admin, dicek SERVER-SIDE dari email akun di auth.users
 * (`adalah_admin_utama()`). Konstanta ini cuma untuk tampilan (sembunyikan/
 * tampilkan baris Admin di ProfilePage) -- BUKAN gerbang keamanan; RPC yang
 * dipanggil di bawah selalu memeriksa ulang lewat fungsi itu.
 */
export const EMAIL_ADMIN_UTAMA = 'yasinumam4@gmail.com'

interface DbPengajuanRow {
  id: string
  guru_id: string
  guru_nama: string
  sekolah_id: string
  sekolah_nama: string
  status: 'menunggu' | 'disetujui' | 'ditolak'
  dibuat_pada: string
  diputuskan_pada: string | null
}

export async function ajukanKepalaSekolah(): Promise<void> {
  const { error } = await supabase.rpc('ajukan_kepala_sekolah')
  if (error) throw new Error(error.message)
}

/** Sekolah guru ini sendiri sudah punya kepala_sekolah atau belum -- dipakai
 *  ProfilePage buat menyembunyikan ajakan "Ajukan jadi Kepala Sekolah" kalau
 *  sudah ada. `false` kalau gagal dimuat (biarkan ajakannya tampil, bukan
 *  diam-diam menyembunyikan sesuatu yang sah karena error jaringan). */
export async function sekolahPunyaKepsek(): Promise<boolean> {
  const { data, error } = await supabase.rpc('sekolah_punya_kepsek')
  if (error) return false
  return data === true
}

/** Pengajuan TERBARU milik guru ini sendiri -- baca langsung (RLS), tanpa RPC. */
export async function ambilPengajuanSaya(guruId: string): Promise<StatusPengajuanKepsek | null> {
  const { data, error } = await supabase
    .from('pengajuan_kepala_sekolah')
    .select('status, dibuat_pada')
    .eq('guru_id', guruId)
    .order('dibuat_pada', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { status: StatusPengajuanKepsek['status']; dibuat_pada: string }
  return { status: row.status, dibuatPada: row.dibuat_pada }
}

export async function ambilPengajuanKepsek(): Promise<PengajuanKepsek[]> {
  const { data, error } = await supabase.rpc('ambil_pengajuan_kepsek')
  if (error) throw new Error(error.message)
  return ((data ?? []) as DbPengajuanRow[]).map(r => ({
    id: r.id, guruId: r.guru_id, guruNama: r.guru_nama,
    sekolahId: r.sekolah_id, sekolahNama: r.sekolah_nama,
    status: r.status, dibuatPada: r.dibuat_pada, diputuskanPada: r.diputuskan_pada,
  }))
}

export async function putuskanPengajuanKepsek(id: string, setuju: boolean): Promise<void> {
  const { error } = await supabase.rpc('putuskan_pengajuan_kepsek', { p_pengajuan_id: id, p_setuju: setuju })
  if (error) throw new Error(error.message)
}

interface DbSekolahRow {
  id: string
  nama: string
  kode_sekolah: string
  created_at: string
  jumlah_guru: number
}

export async function ambilSemuaSekolah(): Promise<SekolahAdmin[]> {
  const { data, error } = await supabase.rpc('ambil_semua_sekolah')
  if (error) throw new Error(error.message)
  return ((data ?? []) as DbSekolahRow[]).map(r => ({
    id: r.id, nama: r.nama, kodeSekolah: r.kode_sekolah,
    dibuatPada: r.created_at, jumlahGuru: Number(r.jumlah_guru),
  }))
}

export async function buatSekolah(nama: string, kode: string): Promise<string> {
  const { data, error } = await supabase.rpc('buat_sekolah', { p_nama: nama, p_kode: kode })
  if (error) throw new Error(error.message)
  return data as string
}
