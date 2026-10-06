import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface SekolahSaya {
  nama: string
  /** Kode yang dimasukkan guru saat mendaftar / di layar Hubungkan ke Sekolah. */
  kode: string
}

/**
 * Sekolah milik akun yang sedang masuk. `undefined` = masih dimuat, `null` =
 * gagal dimuat. RLS (`sekolah_anggota_select`) hanya meloloskan baris sekolah
 * SENDIRI, jadi query tanpa filter pun cuma mengembalikan satu baris.
 *
 * Dipakai kartu Kode sekolah di Menu kepala sekolah: kepala sekolah yang
 * membagikan kodenya ke guru mapel, dan sebelum ini tidak ada satu layar pun
 * yang menampilkannya (kolomnya cuma ada di database).
 */
export function useSekolahSaya(aktif: boolean): SekolahSaya | null | undefined {
  const [sekolah, setSekolah] = useState<SekolahSaya | null | undefined>(undefined)

  useEffect(() => {
    if (!aktif) return
    // Mode uji tampilan (lib/ujiTampilan.ts): tanpa server.
    if (import.meta.env.VITE_UJI_TAMPILAN) { setSekolah({ nama: 'SMK Negeri 1 Contoh', kode: 'SMK1-CONTOH' }); return }
    let batal = false
    void supabase.from('sekolah').select('nama, kode_sekolah').limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (batal) return
        const baris = data as { nama: string; kode_sekolah: string } | null
        setSekolah(error || !baris ? null : { nama: baris.nama, kode: baris.kode_sekolah })
      })
    return () => { batal = true }
  }, [aktif])

  return sekolah
}
