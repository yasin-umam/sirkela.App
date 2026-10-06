import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { SuperSesi, SubmisiSuperSesi, MuridSuperSesi } from '../types'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { PERAN_UJI, submisiUji, superSesiUji } from '../lib/ujiTampilan'

// ─── Super Sesi milik kepala sekolah ─────────────────────────────────────────
// Sama pola fokus/fokuskan dengan SesiContext, tapi TANPA Realtime: kepala
// sekolah tidak punya akses RLS ke sesi_kelas/sesi_murid milik pengawas (itu
// justru intinya -- lihat SS2/SS3 di migrasi super_sesi), jadi pemantauan
// submisi cuma lewat polling RPC pantau_super_sesi(), sama cadence dengan
// LihatJawaban.tsx (10 detik).

interface DbSuperSesi {
  id: string
  judul: string
  deskripsi: string
  status: 'mengumpulkan' | 'berjalan' | 'selesai'
  mulai_pada: string | null
  created_at: string
}

interface MuridServer {
  murid_id: string
  nama: string
  terkunci_pada: string | null
  terakhir_denyut: string | null
  keluar_layar: number
  hilang_fokus: number
}

interface KirimanServer {
  id: string
  mapel: string
  kelas: string
  jurusan: string
  judul: string
  guru_mapel_nama: string
  pengawas_id: string | null
  pengawas_nama: string | null
  sesi_id: string | null
  kode_join: string | null
  sesi_status: 'aktif' | 'selesai' | null
  mulai_pada_sesi: string | null
  kunci_layar: boolean
  jumlah_murid: number
  murid: MuridServer[]
}

interface SuperSesiContextValue {
  semuaSuperSesi: SuperSesi[]
  memuat: boolean
  fokus: SuperSesi | null
  fokuskan: (id: string | null) => void
  /**
   * Super Sesi yang paling relevan SEKARANG (yang berjalan, kalau tidak ada yang
   * mengumpulkan) -- dipantau terus walau tidak ada yang difokuskan, supaya
   * konsol di Menu kepala sekolah punya angkanya tanpa membuka layar Super Sesi.
   */
  bawaan: SuperSesi | null
  buatSuperSesi: (judul: string, deskripsi: string) => Promise<string>
  /** null = belum dimuat sama sekali (beda dari [] = sudah dimuat, kosong). */
  submisi: SubmisiSuperSesi[] | null
  /** Super Sesi mana yang dimiliki `submisi` -- fokus kalau ada, kalau tidak `bawaan`. */
  submisiId: string | null
  memuatSubmisi: boolean
  /**
   * Pengawas TIDAK LAGI ditugaskan kepala sekolah -- sejak migrasi
   * 20260925000000_klaim_kelas_super_sesi.sql, mulai_super_sesi()
   * mendistribusikan kelas TANPA pemilik dan guru mana pun di sekolah itu
   * bebas mengklaimnya sendiri (lihat kelasTersedia/klaimKelasSuper di
   * SesiContext). `pengawasId`/`pengawasNama` di tiap submisi tetap ada,
   * cuma sekarang terisi belakangan lewat klaim, bukan penugasan di sini.
   */
  mulaiSuperSesi: (id: string) => Promise<void>
  /**
   * Mengakhiri Super Sesi yang berjalan beserta SEMUA kelasnya yang masih aktif
   * (diklaim atau belum) -- SS10. Satu-satunya jalan menutup kelas yang tidak
   * pernah diklaim guru mana pun; akhiri_sesi() milik guru tidak bisa menyentuhnya.
   */
  akhiriSuperSesi: (id: string) => Promise<void>
  /**
   * Wewenang buka kunci untuk sesi hasil Super Sesi ADA DI SINI, bukan di
   * pengawas (permintaan pemilik produk) -- lihat migrasi
   * 20260924300000_pengawasan_super_sesi.sql. Ketiganya me-refresh `submisi`
   * langsung sesudah sukses, tidak menunggu jeda poling berikutnya.
   */
  bukaKunciMuridSuper: (sesiId: string, muridId: string) => Promise<void>
  bukaKunciSemuaSuper: (sesiId: string) => Promise<void>
  aturKunciLayarSuper: (sesiId: string, aktif: boolean) => Promise<void>
}

const SuperSesiContext = createContext<SuperSesiContextValue | null>(null)

const JEDA_POLING_MS = 10_000

function petakanSuperSesi(s: DbSuperSesi): SuperSesi {
  return {
    id: s.id, judul: s.judul, deskripsi: s.deskripsi, status: s.status,
    mulaiPada: s.mulai_pada, dibuatPada: s.created_at,
  }
}

function petakanMurid(m: MuridServer): MuridSuperSesi {
  return {
    muridId: m.murid_id, nama: m.nama,
    terkunciPada: m.terkunci_pada, terakhirDenyut: m.terakhir_denyut,
    keluarLayar: m.keluar_layar, hilangFokus: m.hilang_fokus,
  }
}

function petakanKiriman(k: KirimanServer): SubmisiSuperSesi {
  return {
    id: k.id, mapel: k.mapel, kelas: k.kelas, jurusan: k.jurusan ?? '', judul: k.judul,
    guruMapelNama: k.guru_mapel_nama,
    pengawasId: k.pengawas_id, pengawasNama: k.pengawas_nama,
    sesiId: k.sesi_id, kodeJoin: k.kode_join,
    sesiStatus: k.sesi_status, mulaiPadaSesi: k.mulai_pada_sesi,
    kunciLayar: k.kunci_layar,
    jumlahMurid: k.jumlah_murid,
    murid: (k.murid ?? []).map(petakanMurid),
  }
}

export function SuperSesiProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_UJI_TAMPILAN) {
    // Data contoh di lib/ujiTampilan.ts; tidak menyentuh server.
    const [semuaSuperSesi, setSemuaSuperSesi] = useState<SuperSesi[]>(() => (PERAN_UJI === 'kepala_sekolah' ? superSesiUji() : []))
    const [fokusId, setFokusId] = useState<string | null>(null)
    const fokus = semuaSuperSesi.find(s => s.id === fokusId) ?? null
    const bawaan = semuaSuperSesi.find(s => s.status === 'berjalan') ?? semuaSuperSesi.find(s => s.status === 'mengumpulkan') ?? null
    const idPantau = fokusId ?? bawaan?.id ?? null
    const tak = async () => {}
    const value: SuperSesiContextValue = {
      semuaSuperSesi, memuat: false, fokus, fokuskan: setFokusId, bawaan,
      buatSuperSesi: async (judul, deskripsi) => {
        const baru: SuperSesi = { id: `ss${Date.now()}`, judul, deskripsi, status: 'mengumpulkan', mulaiPada: null, dibuatPada: new Date().toISOString() }
        setSemuaSuperSesi(p => [baru, ...p])
        return baru.id
      },
      submisi: idPantau ? submisiUji(idPantau) : null, submisiId: idPantau, memuatSubmisi: false,
      mulaiSuperSesi: async id => { setSemuaSuperSesi(p => p.map(s => s.id === id ? { ...s, status: 'berjalan', mulaiPada: new Date().toISOString() } : s)) },
      akhiriSuperSesi: async id => { setSemuaSuperSesi(p => p.map(s => s.id === id ? { ...s, status: 'selesai' } : s)) },
      bukaKunciMuridSuper: tak, bukaKunciSemuaSuper: tak, aturKunciLayarSuper: tak,
    }
    return <SuperSesiContext.Provider value={value}>{children}</SuperSesiContext.Provider>
  }

  const { user } = useAuth()
  const [semuaSuperSesi, setSemuaSuperSesi] = useState<SuperSesi[]>([])
  const [memuat, setMemuat] = useState(false)
  const [fokusId, setFokusId] = useState<string | null>(null)
  const [submisi, setSubmisi] = useState<SubmisiSuperSesi[] | null>(null)
  const [submisiId, setSubmisiId] = useState<string | null>(null)
  const [memuatSubmisi, setMemuatSubmisi] = useState(false)

  useEffect(() => {
    setSemuaSuperSesi([])
    setFokusId(null)
    if (!user || user.role !== 'kepala_sekolah') return
    let batal = false
    setMemuat(true)
    void (async () => {
      const { data } = await supabase
        .from('super_sesi').select('*').eq('kepsek_id', user.id).order('created_at', { ascending: false })
      if (batal) return
      setSemuaSuperSesi(((data ?? []) as DbSuperSesi[]).map(petakanSuperSesi))
      setMemuat(false)
    })()
    return () => { batal = true }
  }, [user])

  const fokus = useMemo(() => semuaSuperSesi.find(s => s.id === fokusId) ?? null, [semuaSuperSesi, fokusId])

  const fokuskan = useCallback((id: string | null) => {
    setFokusId(id)
    setSubmisi(null)
    setSubmisiId(null)
  }, [])

  // Yang berjalan dulu, baru yang masih mengumpulkan. Yang selesai tidak pernah
  // dipantau sendiri-sendiri: cuma lewat fokus.
  const bawaan = useMemo(
    () => semuaSuperSesi.find(s => s.status === 'berjalan') ?? semuaSuperSesi.find(s => s.status === 'mengumpulkan') ?? null,
    [semuaSuperSesi])
  const idPantau = fokusId ?? bawaan?.id ?? null

  const muatSubmisiRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    setSubmisi(null)
    setSubmisiId(null)
    if (!idPantau) return
    let batal = false
    async function muat() {
      setMemuatSubmisi(true)
      const { data, error } = await supabase.rpc('pantau_super_sesi', { p_super_sesi_id: idPantau })
      if (batal) return
      setMemuatSubmisi(false)
      if (error) return
      const kiriman = (data as { kiriman?: KirimanServer[] })?.kiriman ?? []
      setSubmisi(kiriman.map(petakanKiriman))
      setSubmisiId(idPantau)
    }
    muatSubmisiRef.current = muat
    void muat()
    const id = setInterval(() => void muat(), JEDA_POLING_MS)
    return () => { batal = true; clearInterval(id) }
  }, [idPantau])

  const buatSuperSesi = useCallback(async (judul: string, deskripsi: string): Promise<string> => {
    const { data, error } = await supabase
      .from('super_sesi').insert({ judul, deskripsi }).select('*').single()
    if (error) throw new Error(error.message)
    const baru = petakanSuperSesi(data as DbSuperSesi)
    setSemuaSuperSesi(prev => [baru, ...prev])
    return baru.id
  }, [])

  const mulaiSuperSesi = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('mulai_super_sesi', { p_super_sesi_id: id })
    if (error) throw new Error(error.message)
    setSemuaSuperSesi(prev => prev.map(s => s.id === id ? { ...s, status: 'berjalan', mulaiPada: new Date().toISOString() } : s))
    await muatSubmisiRef.current()
  }, [])

  const akhiriSuperSesi = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('akhiri_super_sesi', { p_super_sesi_id: id })
    if (error) throw new Error('Gagal mengakhiri Super Sesi. Coba lagi.')
    setSemuaSuperSesi(prev => prev.map(s => s.id === id ? { ...s, status: 'selesai' } : s))
    await muatSubmisiRef.current()
  }, [])

  const bukaKunciMuridSuper = useCallback(async (sesiId: string, muridId: string) => {
    const { error } = await supabase.rpc('buka_kunci_murid_kepsek', { p_sesi_id: sesiId, p_murid_id: muridId })
    if (error) throw new Error('Gagal membuka kunci. Coba lagi.')
    await muatSubmisiRef.current()
  }, [])

  const bukaKunciSemuaSuper = useCallback(async (sesiId: string) => {
    const { error } = await supabase.rpc('buka_kunci_semua_kepsek', { p_sesi_id: sesiId })
    if (error) throw new Error('Gagal membuka kunci. Coba lagi.')
    await muatSubmisiRef.current()
  }, [])

  const aturKunciLayarSuper = useCallback(async (sesiId: string, aktif: boolean) => {
    const { error } = await supabase.rpc('atur_kunci_layar_kepsek', { p_sesi_id: sesiId, p_aktif: aktif })
    if (error) throw new Error('Gagal mengubah kunci layar. Coba lagi.')
    await muatSubmisiRef.current()
  }, [])

  const value = useMemo<SuperSesiContextValue>(() => ({
    semuaSuperSesi, memuat, fokus, fokuskan, bawaan, buatSuperSesi,
    submisi, submisiId, memuatSubmisi, mulaiSuperSesi, akhiriSuperSesi,
    bukaKunciMuridSuper, bukaKunciSemuaSuper, aturKunciLayarSuper,
  }), [semuaSuperSesi, memuat, fokus, fokuskan, bawaan, buatSuperSesi, submisi, submisiId, memuatSubmisi, mulaiSuperSesi, akhiriSuperSesi,
      bukaKunciMuridSuper, bukaKunciSemuaSuper, aturKunciLayarSuper])

  return <SuperSesiContext.Provider value={value}>{children}</SuperSesiContext.Provider>
}

export function useSuperSesi(): SuperSesiContextValue {
  const ctx = useContext(SuperSesiContext)
  if (!ctx) throw new Error('useSuperSesi harus digunakan dalam SuperSesiProvider')
  return ctx
}
