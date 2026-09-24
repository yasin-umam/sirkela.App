import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SesiKelas, KontenItem, PesertaSesi, KelasSuperSesiTersedia } from '../types'
import { supabase } from '../lib/supabase'
import type { DbSesiKelas, DbSesiMurid } from '../lib/supabase'
import { useAuth } from './AuthContext'

// ─── Sesi milik guru ─────────────────────────────────────────────────────────
// Semua sesi (aktif & selesai) dipegang dalam SATU daftar; tab Jawaban
// menyaringnya per formulir. Realtime hanya dipasang untuk sesi yang sedang
// DIFOKUSKAN -- layar yang benar-benar dilihat guru.

interface SesiContextValue {
  /** Terbaru dulu. */
  semuaSesi: SesiKelas[]
  fokus: SesiKelas | null
  fokuskan: (id: string | null) => void
  /** MELEMPAR dengan pesan dari server (mis. "Soal nomor 3: kunci jawaban belum dipilih"). */
  bukaSesi: (formulirId: string) => Promise<SesiKelas>
  mulaiSesi: (id: string) => Promise<void>
  akhiriSesi: (id: string) => Promise<void>
  /** Hanya boleh SEBELUM mulaiSesi -- server menolak begitu mulai_pada terisi. */
  aturDurasiSesi: (id: string, menit: number) => Promise<void>
  /** Mematikan = membebaskan semua murid yang sedang terkunci (atur_kunci_layar). */
  aturKunciLayar: (id: string, aktif: boolean) => Promise<void>
  bukaKunciMurid: (sesiId: string, muridId: string) => Promise<void>
  bukaKunciSemua: (sesiId: string) => Promise<void>
  /**
   * Kelas hasil distribusi Super Sesi yang BELUM diklaim siapa pun, dipoling
   * tiap 10 detik selama akun ini guru/kepala sekolah (bukan murid) -- lihat
   * ambil_kelas_tersedia_super_sesi(). Tidak ada Realtime di sini: baris
   * sesi_kelas belum punya guru_id, jadi tidak ada kanal per-guru yang bisa
   * dipasangi listener.
   */
  kelasTersedia: KelasSuperSesiTersedia[]
  /** MELEMPAR "Kelas ini sudah diambil guru lain" kalau kalah rebutan (SS9). */
  klaimKelasSuper: (sesiId: string) => Promise<SesiKelas>
}

// Jenis peristiwa yang dihitung di baris peserta. Peristiwa lain (kembali_*,
// dikunci, dibuka_guru) tetap tersimpan sebagai log, tapi tidak menambah angka --
// `dikunci` sudah terbaca dari terkunci_pada.
const JENIS_KELUAR = 'tinggalkan_layar'
const JENIS_FOKUS = 'hilang_fokus'

const SesiContext = createContext<SesiContextValue | null>(null)

function petakanSesi(s: DbSesiKelas, peserta: PesertaSesi[]): SesiKelas {
  return {
    id: s.id, formulirId: s.formulir_id, judul: s.judul, deskripsi: s.deskripsi ?? '',
    durasiMenit: s.durasi_menit,
    mulaiPada: s.mulai_pada, selesaiPada: s.selesai_pada,
    status: s.status,
    kodeJoin: s.kode_join,
    // Dirakit server (buka_sesi_formulir), dan server menyaring ulang per tipe
    // saat membacanya untuk murid (ambil_konten_sesi).
    kontenList: s.konten_list as KontenItem[],
    kunciLayar: s.kunci_layar,
    muridJoined: peserta,
    dibuatPada: s.created_at,
    superSesiId: s.super_sesi_id,
    superSesiJudul: s.super_sesi_judul,
  }
}

interface KelasTersediaServer {
  sesi_id: string
  mapel: string
  kelas: string
  judul: string
  super_sesi_judul: string
  durasi_menit: number
  created_at: string
}

function petakanKelasTersedia(k: KelasTersediaServer): KelasSuperSesiTersedia {
  return {
    sesiId: k.sesi_id, mapel: k.mapel, kelas: k.kelas, judul: k.judul,
    superSesiJudul: k.super_sesi_judul, durasiMenit: k.durasi_menit, dibuatPada: k.created_at,
  }
}

export function SesiProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_UJI_TAMPILAN) {
    const [semuaSesi, setSemuaSesi] = useState<SesiKelas[]>([{
      id: 'sesi1', formulirId: 'f1', judul: 'Ulangan Harian Bab 3', deskripsi: '', durasiMenit: 45,
      mulaiPada: null, selesaiPada: null, status: 'aktif', kontenList: [], kodeJoin: 'AB12CD',
      kunciLayar: false, muridJoined: [], dibuatPada: new Date().toISOString(),
      superSesiId: null, superSesiJudul: null,
    }])
    const [fokusId, setFokusId] = useState<string | null>(null)
    const fokus = semuaSesi.find(s => s.id === fokusId) ?? null
    const ubah = (id: string, fn: (s: SesiKelas) => SesiKelas) =>
      setSemuaSesi(prev => prev.map(s => s.id === id ? fn(s) : s))
    const value: SesiContextValue = {
      semuaSesi, fokus, fokuskan: setFokusId,
      bukaSesi: async () => semuaSesi[0],
      mulaiSesi: async id => { ubah(id, s => ({ ...s, mulaiPada: new Date().toISOString() })) },
      akhiriSesi: async id => { ubah(id, s => ({ ...s, status: 'selesai' })) },
      aturDurasiSesi: async (id, menit) => { ubah(id, s => ({ ...s, durasiMenit: menit })) },
      aturKunciLayar: async (id, aktif) => { ubah(id, s => ({ ...s, kunciLayar: aktif })) },
      bukaKunciMurid: async () => {},
      bukaKunciSemua: async () => {},
      kelasTersedia: [],
      klaimKelasSuper: async () => semuaSesi[0],
    }
    return <SesiContext.Provider value={value}>{children}</SesiContext.Provider>
  }

  const { user } = useAuth()
  const [semuaSesi, setSemuaSesi] = useState<SesiKelas[]>([])
  const [fokusId, setFokusId] = useState<string | null>(null)
  const [kelasTersedia, setKelasTersedia] = useState<KelasSuperSesiTersedia[]>([])

  useEffect(() => {
    setSemuaSesi([])
    setFokusId(null)
    // kepala_sekolah tetap guru mapel biasa untuk sesinya sendiri (2026-09-24),
    // dan juga jadi pengawas sesi hasil Super Sesi -- cuma murid yang tidak pernah.
    if (!user || user.role === 'murid') return
    let batal = false
    void (async () => {
      const { data: sesiData, error } = await supabase
        .from('sesi_kelas').select('*').eq('guru_id', user.id).order('created_at', { ascending: false })
      if (batal || error || !sesiData) return
      const rows = sesiData as DbSesiKelas[]
      const ids = rows.map(s => s.id)

      // Sekali saja dengan `in`, bukan satu query per sesi.
      const [{ data: muridData }, { data: peristiwaData }] = ids.length
        ? await Promise.all([
            supabase.from('sesi_murid').select('*').in('sesi_id', ids),
            supabase.from('sesi_peristiwa').select('sesi_id, murid_id, jenis')
              .in('jenis', [JENIS_KELUAR, JENIS_FOKUS]).in('sesi_id', ids),
          ])
        : [{ data: [] }, { data: [] }]
      if (batal) return

      const keluarPer = new Map<string, number>()
      const fokusPer = new Map<string, number>()
      for (const p of (peristiwaData ?? []) as { sesi_id: string; murid_id: string; jenis: string }[]) {
        const k = `${p.sesi_id}|${p.murid_id}`
        const peta = p.jenis === JENIS_KELUAR ? keluarPer : fokusPer
        peta.set(k, (peta.get(k) ?? 0) + 1)
      }

      const pesertaPer = new Map<string, PesertaSesi[]>()
      for (const m of (muridData ?? []) as DbSesiMurid[]) {
        if (!pesertaPer.has(m.sesi_id)) pesertaPer.set(m.sesi_id, [])
        const k = `${m.sesi_id}|${m.murid_id}`
        pesertaPer.get(m.sesi_id)!.push({
          muridId: m.murid_id,
          nama: m.nama,
          terakhirDenyut: m.terakhir_denyut,
          keluarLayar: keluarPer.get(k) ?? 0,
          hilangFokus: fokusPer.get(k) ?? 0,
          terkunciPada: m.terkunci_pada,
        })
      }

      setSemuaSesi(rows.map(s => petakanSesi(s, pesertaPer.get(s.id) ?? [])))
    })()
    return () => { batal = true }
  }, [user])

  // Kelas Super Sesi yang sudah didistribusikan tapi belum diklaim siapa pun --
  // dipoling, bukan Realtime (baris belum punya guru_id untuk dijadikan kanal
  // per-guru). Dipoling untuk guru DAN kepala sekolah (adalah_guru() di server
  // sudah melonggarkan itu sejak kepsek_guru_gabung), tidak untuk murid.
  useEffect(() => {
    setKelasTersedia([])
    if (!user || user.role === 'murid') return
    let batal = false
    async function muat() {
      const { data, error } = await supabase.rpc('ambil_kelas_tersedia_super_sesi')
      if (batal || error) return
      setKelasTersedia((data as KelasTersediaServer[] ?? []).map(petakanKelasTersedia))
    }
    void muat()
    const id = setInterval(() => void muat(), 10_000)
    return () => { batal = true; clearInterval(id) }
  }, [user])

  const ubahSesi = useCallback((id: string, ubah: (s: SesiKelas) => SesiKelas) => {
    setSemuaSesi(prev => prev.map(s => s.id === id ? ubah(s) : s))
  }, [])

  const fokus = useMemo(() => semuaSesi.find(s => s.id === fokusId) ?? null, [semuaSesi, fokusId])
  const fokusAktif = fokus?.status === 'aktif' ? fokus.id : null

  // Realtime, arah murid -> guru. Arah sebaliknya TIDAK bisa lewat sini: murid
  // tidak punya policy SELECT di sesi_kelas (A1). Murid menanyakan status lewat
  // RPC status_sesi().
  useEffect(() => {
    const sesiId = fokusAktif
    if (!sesiId) return

    function ubahPeserta(muridId: string, ubah: (p: PesertaSesi) => PesertaSesi) {
      ubahSesi(sesiId!, s => ({ ...s, muridJoined: s.muridJoined.map(p => p.muridId === muridId ? ubah(p) : p) }))
    }

    const channel = supabase
      .channel(`sesi-${sesiId}`)
      // Di-dedupe by murid_id: event bisa sampai dua kali (reconnect).
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sesi_murid', filter: `sesi_id=eq.${sesiId}`,
      }, payload => {
        const row = payload.new as DbSesiMurid
        ubahSesi(sesiId, s => s.muridJoined.some(p => p.muridId === row.murid_id) ? s : {
          ...s,
          muridJoined: [...s.muridJoined, {
            muridId: row.murid_id, nama: row.nama,
            terakhirDenyut: row.terakhir_denyut, keluarLayar: 0,
            hilangFokus: 0, terkunciPada: row.terkunci_pada,
          }],
        })
      })
      // Denyut, ganti nama (set_nama_peserta), dan kunci terpasang/dibuka --
      // satu baris yang sama dipakai ketiganya, jadi satu handler UPDATE cukup.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sesi_murid', filter: `sesi_id=eq.${sesiId}`,
      }, payload => {
        const row = payload.new as DbSesiMurid
        ubahPeserta(row.murid_id, p => ({
          ...p, terakhirDenyut: row.terakhir_denyut, nama: row.nama, terkunciPada: row.terkunci_pada,
        }))
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sesi_peristiwa', filter: `sesi_id=eq.${sesiId}`,
      }, payload => {
        const row = payload.new as { murid_id: string; jenis: string }
        if (row.jenis === JENIS_KELUAR) {
          ubahPeserta(row.murid_id, p => ({ ...p, keluarLayar: p.keluarLayar + 1 }))
        } else if (row.jenis === JENIS_FOKUS) {
          ubahPeserta(row.murid_id, p => ({ ...p, hilangFokus: p.hilangFokus + 1 }))
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fokusAktif, ubahSesi])

  const fokuskan = useCallback((id: string | null) => setFokusId(id), [])

  // Snapshot soal, kode unik, dan pemeriksaan kelengkapan semuanya di server (F2).
  const bukaSesi = useCallback(async (formulirId: string) => {
    const { data, error } = await supabase.rpc('buka_sesi_formulir', { p_formulir_id: formulirId })
    if (error) throw new Error(/fetch|network/i.test(error.message) ? 'Tidak ada koneksi. Coba lagi.' : error.message)
    const sesi = petakanSesi(data as DbSesiKelas, [])
    setSemuaSesi(prev => [sesi, ...prev])
    setFokusId(sesi.id)
    return sesi
  }, [])

  // Waktu mulai & selesai ditetapkan SERVER (now() di dalam RPC).
  const mulaiSesi = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('mulai_sesi', { p_sesi_id: id })
    if (error) throw new Error('Gagal memulai sesi. Coba lagi.')
    const mulaiPada = (data as { mulai_pada: string | null })?.mulai_pada ?? null
    ubahSesi(id, s => ({ ...s, mulaiPada }))
  }, [ubahSesi])

  const akhiriSesi = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('akhiri_sesi', { p_sesi_id: id })
    if (error) throw new Error('Gagal mengakhiri sesi. Coba lagi.')
    const selesaiPada = (data as { selesai_pada: string | null })?.selesai_pada ?? new Date().toISOString()
    ubahSesi(id, s => ({ ...s, status: 'selesai', selesaiPada }))
  }, [ubahSesi])

  const aturDurasiSesi = useCallback(async (id: string, menit: number) => {
    const { error } = await supabase.rpc('atur_durasi_sesi', { p_sesi_id: id, p_menit: menit })
    if (error) throw new Error(error.message)
    ubahSesi(id, s => ({ ...s, durasiMenit: menit }))
  }, [ubahSesi])

  // ── Kunci Layar Sesi ──
  // Status kunci murid TIDAK diubah optimistis: yang benar-benar membuka kunci
  // adalah baris sesi_murid, dan perubahannya sampai lewat Realtime UPDATE di
  // atas. Layar yang menulis "terbuka" sebelum server setuju akan membohongi guru
  // persis saat RPC-nya gagal.
  const aturKunciLayar = useCallback(async (id: string, aktif: boolean) => {
    const { error } = await supabase.rpc('atur_kunci_layar', { p_sesi_id: id, p_aktif: aktif })
    if (error) throw new Error('Gagal mengubah kunci layar. Coba lagi.')
    ubahSesi(id, s => ({ ...s, kunciLayar: aktif }))
  }, [ubahSesi])

  const bukaKunciMurid = useCallback(async (sesiId: string, muridId: string) => {
    const { error } = await supabase.rpc('buka_kunci_murid', { p_sesi_id: sesiId, p_murid_id: muridId })
    if (error) throw new Error('Gagal membuka kunci. Coba lagi.')
  }, [])

  const bukaKunciSemua = useCallback(async (sesiId: string) => {
    const { error } = await supabase.rpc('buka_kunci_semua', { p_sesi_id: sesiId })
    if (error) throw new Error('Gagal membuka kunci. Coba lagi.')
  }, [])

  // SS9: server menolak atomik kalau kelasnya sudah diklaim guru lain --
  // pesannya diteruskan apa adanya supaya UI bisa menampilkannya langsung.
  const klaimKelasSuper = useCallback(async (sesiId: string): Promise<SesiKelas> => {
    const { data, error } = await supabase.rpc('klaim_kelas_super_sesi', { p_sesi_id: sesiId })
    if (error) throw new Error(error.message)
    const sesi = petakanSesi(data as DbSesiKelas, [])
    setSemuaSesi(prev => [sesi, ...prev])
    setKelasTersedia(prev => prev.filter(k => k.sesiId !== sesiId))
    return sesi
  }, [])

  const value = useMemo<SesiContextValue>(() => ({
    semuaSesi, fokus, fokuskan, bukaSesi, mulaiSesi, akhiriSesi,
    aturDurasiSesi, aturKunciLayar, bukaKunciMurid, bukaKunciSemua,
    kelasTersedia, klaimKelasSuper,
  }), [semuaSesi, fokus, fokuskan, bukaSesi, mulaiSesi, akhiriSesi, aturDurasiSesi, aturKunciLayar, bukaKunciMurid, bukaKunciSemua,
      kelasTersedia, klaimKelasSuper])

  return <SesiContext.Provider value={value}>{children}</SesiContext.Provider>
}

export function useSesi(): SesiContextValue {
  const ctx = useContext(SesiContext)
  if (!ctx) throw new Error('useSesi harus digunakan dalam SesiProvider')
  return ctx
}
