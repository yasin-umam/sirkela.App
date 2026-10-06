import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Id formulir yang PERNAH dikirim guru ini ke sebuah Super Sesi -- cuma penanda
 * ringan di daftar formulir (Riwayat, Menu desktop), bukan status penuh (itu ada
 * di layar kepala sekolah). super_sesi_soal_guru_select sudah menyaring ke
 * kiriman milik guru ini sendiri.
 */
export function useKirimanSuper(): Set<string> {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    if (import.meta.env.VITE_UJI_TAMPILAN) { setIds(new Set(['f3'])); return }
    let batal = false
    void supabase.from('super_sesi_soal').select('formulir_id').eq('guru_mapel_id', user.id)
      .then(({ data }) => {
        if (batal) return
        setIds(new Set(
          ((data ?? []) as { formulir_id: string | null }[]).map(r => r.formulir_id).filter((id): id is string => !!id)
        ))
      })
    return () => { batal = true }
  }, [user])

  return ids
}
