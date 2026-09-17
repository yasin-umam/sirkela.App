import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Formulir, IsiSoal, Soal } from '../types'
import { supabase } from '../lib/supabase'
import type { DbBankSoal, DbFormulir } from '../lib/supabase'
import { buatUuid } from '../lib/soal'
import { useAuth } from './AuthContext'

// ─── Formulir & soalnya, disimpan otomatis ala Google Form ───────────────────
// Layar SELALU menulis ke state lokal lebih dulu; database menyusul lewat satu
// ANTREAN berurutan. Berurutan itu syarat, bukan kerapian: soal baru di-insert
// lalu langsung diketik -- update yang mendahului insert-nya mengenai nol baris
// dan ketikannya hilang tanpa error.
//
// Ketikan di-debounce per soal (JEDA_KETIK_MS) supaya satu kalimat bukan tiga
// puluh UPDATE. Semua yang masih tertahan di-flush sebelum pindah formulir,
// sebelum sesi dibuka (simpanSekarang), dan saat tab disembunyikan.

const JEDA_KETIK_MS = 600
const KUNCI_TERAKHIR = 'sesi-soal:formulir_terakhir'

export type StatusSimpan = 'tersimpan' | 'menyimpan' | 'gagal'
export type UbahanFormulir = Partial<Pick<Formulir, 'judul' | 'deskripsi' | 'durasiMenit' | 'kunciLayar' | 'gformId'>>
export interface RingkasFormulir extends Formulir { jumlahSoal: number }

interface FormulirContextValue {
  daftar: RingkasFormulir[]
  memuat: boolean
  aktif: Formulir | null
  soal: Soal[]
  memuatSoal: boolean
  statusSimpan: StatusSimpan
  pilihFormulir: (id: string) => void
  /** MELEMPAR kalau gagal. Formulir baru langsung jadi yang aktif. */
  buatFormulir: (awal?: UbahanFormulir) => Promise<string>
  ubahFormulir: (ubahan: UbahanFormulir) => void
  /** MELEMPAR kalau gagal. */
  hapusFormulir: (id: string) => Promise<void>
  /** Mengembalikan id soal baru SEKETIKA; insert-nya menyusul di antrean. */
  tambahSoal: (posisi: number, isi?: Partial<IsiSoal>, id?: string) => string
  ubahSoal: (id: string, ubahan: Partial<IsiSoal>) => void
  /** Mengembalikan soal & posisinya, untuk "Urungkan". */
  hapusSoal: (id: string) => { soal: Soal; posisi: number } | null
  duplikatSoal: (id: string) => string | null
  pindahSoal: (id: string, arah: -1 | 1) => void
  /** Menambah di akhir formulir aktif. MELEMPAR kalau insert-nya gagal. */
  imporSoal: (daftarSoal: IsiSoal[]) => Promise<void>
  /** Flush semua ketikan tertahan lalu tunggu antrean kosong. `false` = ada yang gagal. */
  simpanSekarang: () => Promise<boolean>
  cobaSimpanLagi: () => void
}

const FormulirContext = createContext<FormulirContextValue | null>(null)

function petakanFormulir(r: DbFormulir): Formulir {
  return {
    id: r.id, judul: r.judul, deskripsi: r.deskripsi, durasiMenit: r.durasi_menit,
    kunciLayar: r.kunci_layar, gformId: r.gform_id, dibuatPada: r.created_at, diperbaruiPada: r.diperbarui_pada,
  }
}

function petakanSoal(r: DbBankSoal): Soal {
  return {
    id: r.id, formulirId: r.formulir_id, pertanyaan: r.pertanyaan, pilihan: r.pilihan,
    jawabanBenar: r.jawaban_benar, urutan: r.urutan,
  }
}

function barisFormulir(u: UbahanFormulir): Partial<DbFormulir> {
  const b: Partial<DbFormulir> = {}
  if (u.judul !== undefined) b.judul = u.judul
  if (u.deskripsi !== undefined) b.deskripsi = u.deskripsi
  if (u.durasiMenit !== undefined) b.durasi_menit = u.durasiMenit
  if (u.kunciLayar !== undefined) b.kunci_layar = u.kunciLayar
  if (u.gformId !== undefined) b.gform_id = u.gformId
  return b
}

function barisSoal(u: Partial<IsiSoal>): Partial<DbBankSoal> {
  const b: Partial<DbBankSoal> = {}
  if (u.pertanyaan !== undefined) b.pertanyaan = u.pertanyaan
  if (u.pilihan !== undefined) b.pilihan = u.pilihan
  if (u.jawabanBenar !== undefined) b.jawaban_benar = u.jawabanBenar
  return b
}

/** urutan = posisi. Yang dikembalikan hanya baris yang urutannya BERUBAH. */
function nomoriUlang(list: Soal[]): { list: Soal[]; berubah: { id: string; urutan: number }[] } {
  const berubah: { id: string; urutan: number }[] = []
  const baru = list.map((s, i) => {
    if (s.urutan === i) return s
    berubah.push({ id: s.id, urutan: i })
    return { ...s, urutan: i }
  })
  return { list: baru, berubah }
}

function bacaTerakhir(): string | null {
  try { return localStorage.getItem(KUNCI_TERAKHIR) } catch { return null }
}
function tulisTerakhir(id: string) {
  try { localStorage.setItem(KUNCI_TERAKHIR, id) } catch { /* mode privat */ }
}

export function FormulirProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [daftarMentah, setDaftarMentah] = useState<RingkasFormulir[]>([])
  const [memuat, setMemuat] = useState(false)
  const [aktifId, setAktifId] = useState<string | null>(null)
  const [soal, setSoal] = useState<Soal[]>([])
  const [memuatSoal, setMemuatSoal] = useState(false)
  const [statusSimpan, setStatusSimpan] = useState<StatusSimpan>('tersimpan')

  // Cermin state untuk operasi baca-ubah-tulis beruntun (dua ketukan cepat
  // "tambah soal" tidak boleh sama-sama membaca daftar lama).
  const soalRef = useRef<Soal[]>([])
  soalRef.current = soal
  const aktifIdRef = useRef<string | null>(null)
  aktifIdRef.current = aktifId
  const daftarRef = useRef<RingkasFormulir[]>([])
  daftarRef.current = daftarMentah

  // ── Antrean tulis ──
  const rantai = useRef<Promise<void>>(Promise.resolve())
  const jumlahAntre = useRef(0)
  const gagal = useRef<(() => Promise<void>)[]>([])
  const ketikanSoal = useRef(new Map<string, { baris: Partial<DbBankSoal>; timer: number }>())
  const ketikanForm = useRef<{ id: string; baris: Partial<DbFormulir>; timer: number } | null>(null)

  const perbaruiStatus = useCallback(() => {
    const tertahan = ketikanSoal.current.size > 0 || ketikanForm.current !== null
    if (jumlahAntre.current > 0 || tertahan) setStatusSimpan('menyimpan')
    else setStatusSimpan(gagal.current.length > 0 ? 'gagal' : 'tersimpan')
  }, [])

  const antre = useCallback((op: () => Promise<void>): Promise<boolean> => {
    jumlahAntre.current++
    perbaruiStatus()
    let berhasil = true
    const giliran = rantai.current.then(async () => {
      try {
        await op()
      } catch (e) {
        berhasil = false
        gagal.current.push(op)
        console.error('[formulir]', e instanceof Error ? e.message : e)
      } finally {
        jumlahAntre.current--
        perbaruiStatus()
      }
    })
    rantai.current = giliran
    return giliran.then(() => berhasil)
  }, [perbaruiStatus])

  const flushSoal = useCallback((id: string) => {
    const tertahan = ketikanSoal.current.get(id)
    if (!tertahan) return
    window.clearTimeout(tertahan.timer)
    ketikanSoal.current.delete(id)
    void antre(async () => {
      const { data, error } = await supabase.from('bank_soal').update(tertahan.baris).eq('id', id).select('id')
      if (error) throw new Error(error.message)
      // Nol baris tanpa error = soalnya sudah dihapus (tab lain), bukan sukses.
      if (!data?.length) throw new Error('Soal tidak ditemukan')
    })
  }, [antre])

  const flushForm = useCallback(() => {
    const tertahan = ketikanForm.current
    if (!tertahan) return
    window.clearTimeout(tertahan.timer)
    ketikanForm.current = null
    void antre(async () => {
      const { error } = await supabase.from('formulir').update(tertahan.baris).eq('id', tertahan.id)
      if (error) throw new Error(error.message)
    })
  }, [antre])

  const flushSemua = useCallback(() => {
    for (const id of [...ketikanSoal.current.keys()]) flushSoal(id)
    flushForm()
  }, [flushSoal, flushForm])

  const simpanSekarang = useCallback(async () => {
    flushSemua()
    await rantai.current
    return gagal.current.length === 0
  }, [flushSemua])

  const cobaSimpanLagi = useCallback(() => {
    const ulang = gagal.current
    gagal.current = []
    for (const op of ulang) void antre(op)
    perbaruiStatus()
  }, [antre, perbaruiStatus])

  // Tab disembunyikan (pindah aplikasi, layar mati) bisa jadi saat terakhir
  // halaman ini hidup -- jangan biarkan ketikan menunggu debounce.
  useEffect(() => {
    const onSembunyi = () => { if (document.visibilityState === 'hidden') flushSemua() }
    const onTutup = (e: BeforeUnloadEvent) => {
      flushSemua()
      if (jumlahAntre.current > 0) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onSembunyi)
    window.addEventListener('beforeunload', onTutup)
    return () => {
      document.removeEventListener('visibilitychange', onSembunyi)
      window.removeEventListener('beforeunload', onTutup)
    }
  }, [flushSemua])

  // ── Memuat ──
  const nomorMuat = useRef(0)
  const muatSoal = useCallback((formulirId: string) => {
    const nomor = ++nomorMuat.current
    setMemuatSoal(true)
    void supabase.from('bank_soal').select('*').eq('formulir_id', formulirId)
      .order('urutan').order('created_at')
      .then(({ data, error }) => {
        // Guru sudah pindah ke formulir lain sebelum jawaban ini sampai.
        if (nomor !== nomorMuat.current) return
        if (error) console.error('[muatSoal]', error.message)
        setSoal(((data ?? []) as DbBankSoal[]).map(petakanSoal))
        setMemuatSoal(false)
      })
  }, [])

  const aktifkan = useCallback((id: string | null, opsi?: { kosong?: boolean }) => {
    flushSemua()
    setAktifId(id)
    if (!id) { ++nomorMuat.current; setSoal([]); setMemuatSoal(false); return }
    tulisTerakhir(id)
    if (opsi?.kosong) {
      // Formulir yang BARU dibuat pasti kosong. Tanpa jalan pintas ini, fetch-nya
      // bisa sampai SETELAH soal impor ditambahkan dan menimpanya dengan [].
      ++nomorMuat.current
      setSoal([])
      setMemuatSoal(false)
    } else {
      muatSoal(id)
    }
  }, [flushSemua, muatSoal])

  useEffect(() => {
    setDaftarMentah([])
    setAktifId(null)
    setSoal([])
    if (!user || user.role !== 'guru') return
    let batal = false
    setMemuat(true)
    void supabase.from('formulir').select('*, bank_soal(count)').order('diperbarui_pada', { ascending: false })
      .then(({ data, error }) => {
        if (batal) return
        setMemuat(false)
        if (error) { console.error('[muatFormulir]', error.message); return }
        const rows = (data ?? []) as (DbFormulir & { bank_soal: { count: number }[] })[]
        const list = rows.map(r => ({ ...petakanFormulir(r), jumlahSoal: r.bank_soal?.[0]?.count ?? 0 }))
        setDaftarMentah(list)
        const terakhir = bacaTerakhir()
        const pilihan = list.find(f => f.id === terakhir) ?? list[0]
        if (pilihan) aktifkan(pilihan.id)
      })
    return () => { batal = true }
  }, [user, aktifkan])

  // Jumlah soal formulir aktif diturunkan dari daftar soal yang sedang dipegang,
  // bukan disimpan dua kali.
  const daftar = useMemo(() => daftarMentah
    .map(f => f.id === aktifId && !memuatSoal ? { ...f, jumlahSoal: soal.length } : f)
    .sort((a, b) => b.diperbaruiPada.localeCompare(a.diperbaruiPada)),
  [daftarMentah, aktifId, soal.length, memuatSoal])
  const aktif = useMemo(() => daftarMentah.find(f => f.id === aktifId) ?? null, [daftarMentah, aktifId])

  const sentuh = useCallback((id: string, ubahan: UbahanFormulir = {}) => {
    const kini = new Date().toISOString()
    setDaftarMentah(prev => prev.map(f => f.id === id ? { ...f, ...ubahan, diperbaruiPada: kini } : f))
  }, [])

  // ── Formulir ──
  const pilihFormulir = useCallback((id: string) => {
    if (id !== aktifIdRef.current) aktifkan(id)
  }, [aktifkan])

  const buatFormulir = useCallback(async (awal: UbahanFormulir = {}) => {
    const { data, error } = await supabase.from('formulir').insert(barisFormulir(awal)).select().single()
    if (error || !data) throw new Error(error?.message ?? 'Gagal membuat formulir')
    const baru = { ...petakanFormulir(data as DbFormulir), jumlahSoal: 0 }
    setDaftarMentah(prev => [baru, ...prev])
    aktifkan(baru.id, { kosong: true })
    return baru.id
  }, [aktifkan])

  const ubahFormulir = useCallback((ubahan: UbahanFormulir) => {
    const id = aktifIdRef.current
    if (!id) return
    sentuh(id, ubahan)
    const lama = ketikanForm.current
    if (lama && lama.id !== id) flushForm()
    const sisa = ketikanForm.current
    if (sisa) window.clearTimeout(sisa.timer)
    ketikanForm.current = {
      id,
      baris: { ...(sisa?.baris ?? {}), ...barisFormulir(ubahan) },
      timer: window.setTimeout(flushForm, JEDA_KETIK_MS),
    }
    perbaruiStatus()
  }, [sentuh, flushForm, perbaruiStatus])

  const hapusFormulir = useCallback(async (id: string) => {
    if (ketikanForm.current?.id === id) {
      window.clearTimeout(ketikanForm.current.timer)
      ketikanForm.current = null
    }
    if (id === aktifIdRef.current) {
      for (const t of ketikanSoal.current.values()) window.clearTimeout(t.timer)
      ketikanSoal.current.clear()
    }
    await rantai.current
    const { error } = await supabase.from('formulir').delete().eq('id', id)
    if (error) throw new Error(error.message)
    const sisa = daftarRef.current.filter(f => f.id !== id)
    setDaftarMentah(sisa)
    perbaruiStatus()
    if (id === aktifIdRef.current) {
      const berikutnya = [...sisa].sort((a, b) => b.diperbaruiPada.localeCompare(a.diperbaruiPada))[0]
      aktifkan(berikutnya?.id ?? null)
    }
  }, [aktifkan, perbaruiStatus])

  // ── Soal ──
  const terapkanUrutan = useCallback((list: Soal[], kecuali?: string) => {
    const { list: bernomor, berubah } = nomoriUlang(list)
    setSoal(bernomor)
    soalRef.current = bernomor
    const perlu = berubah.filter(b => b.id !== kecuali)
    if (perlu.length) {
      void antre(async () => {
        const hasil = await Promise.all(perlu.map(b => supabase.from('bank_soal').update({ urutan: b.urutan }).eq('id', b.id)))
        const salah = hasil.find(h => h.error)
        if (salah?.error) throw new Error(salah.error.message)
      })
    }
    return bernomor
  }, [antre])

  const tambahSoal = useCallback((posisi: number, isi: Partial<IsiSoal> = {}, idPakai?: string) => {
    const formulirId = aktifIdRef.current
    if (!formulirId) return ''
    const id = idPakai ?? buatUuid()
    const baru: Soal = {
      id, formulirId,
      pertanyaan: isi.pertanyaan ?? '',
      pilihan: isi.pilihan ?? ['Opsi 1'],
      jawabanBenar: isi.jawabanBenar ?? null,
      urutan: -1,
    }
    const list = [...soalRef.current]
    const di = Math.max(0, Math.min(posisi, list.length))
    list.splice(di, 0, baru)
    // Insert DULU di antrean, baru geser urutan soal di bawahnya.
    void antre(async () => {
      const { error } = await supabase.from('bank_soal').insert({
        id, formulir_id: formulirId, pertanyaan: baru.pertanyaan, pilihan: baru.pilihan,
        jawaban_benar: baru.jawabanBenar, urutan: di,
      })
      if (error) throw new Error(error.message)
    })
    terapkanUrutan(list, id)
    sentuh(formulirId)
    return id
  }, [antre, terapkanUrutan, sentuh])

  const ubahSoal = useCallback((id: string, ubahan: Partial<IsiSoal>) => {
    const baru = soalRef.current.map(s => s.id === id ? { ...s, ...ubahan } : s)
    soalRef.current = baru
    setSoal(baru)
    const lama = ketikanSoal.current.get(id)
    if (lama) window.clearTimeout(lama.timer)
    ketikanSoal.current.set(id, {
      baris: { ...(lama?.baris ?? {}), ...barisSoal(ubahan) },
      timer: window.setTimeout(() => flushSoal(id), JEDA_KETIK_MS),
    })
    if (aktifIdRef.current) sentuh(aktifIdRef.current)
    perbaruiStatus()
  }, [flushSoal, sentuh, perbaruiStatus])

  const hapusSoal = useCallback((id: string) => {
    const posisi = soalRef.current.findIndex(s => s.id === id)
    if (posisi === -1) return null
    const dihapus = soalRef.current[posisi]
    // Ketikan yang belum terkirim untuk soal ini tidak ada gunanya lagi.
    const tertahan = ketikanSoal.current.get(id)
    if (tertahan) { window.clearTimeout(tertahan.timer); ketikanSoal.current.delete(id) }
    void antre(async () => {
      const { error } = await supabase.from('bank_soal').delete().eq('id', id)
      if (error) throw new Error(error.message)
    })
    terapkanUrutan(soalRef.current.filter(s => s.id !== id))
    if (aktifIdRef.current) sentuh(aktifIdRef.current)
    return { soal: dihapus, posisi }
  }, [antre, terapkanUrutan, sentuh])

  const duplikatSoal = useCallback((id: string) => {
    const posisi = soalRef.current.findIndex(s => s.id === id)
    if (posisi === -1) return null
    const s = soalRef.current[posisi]
    return tambahSoal(posisi + 1, { pertanyaan: s.pertanyaan, pilihan: [...s.pilihan], jawabanBenar: s.jawabanBenar })
  }, [tambahSoal])

  const pindahSoal = useCallback((id: string, arah: -1 | 1) => {
    const list = [...soalRef.current]
    const i = list.findIndex(s => s.id === id)
    const j = i + arah
    if (i === -1 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    terapkanUrutan(list)
  }, [terapkanUrutan])

  const imporSoal = useCallback(async (daftarSoal: IsiSoal[]) => {
    const formulirId = aktifIdRef.current
    if (!formulirId || daftarSoal.length === 0) return
    const awal = soalRef.current.length
    const baru: Soal[] = daftarSoal.map((s, i) => ({
      id: buatUuid(), formulirId, pertanyaan: s.pertanyaan, pilihan: s.pilihan,
      jawabanBenar: s.jawabanBenar, urutan: awal + i,
    }))
    const list = [...soalRef.current, ...baru]
    soalRef.current = list
    setSoal(list)
    sentuh(formulirId)
    // SATU insert: impor yang gagal separuh jalan lalu diulang akan menggandakan soal.
    const op = async () => {
      const { error } = await supabase.from('bank_soal').insert(baru.map(s => ({
        id: s.id, formulir_id: formulirId, pertanyaan: s.pertanyaan, pilihan: s.pilihan,
        jawaban_benar: s.jawabanBenar, urutan: s.urutan,
      })))
      if (error) throw new Error(error.message)
    }
    if (!await antre(op)) {
      // Dibuang dari antrean ulang juga: layar impor yang melaporkan gagal, dan
      // guru mengulang dari sana -- bukan tombol "coba lagi" yang diam-diam
      // menggandakan hasil impor kedua.
      gagal.current = gagal.current.filter(o => o !== op)
      const ids = new Set(baru.map(s => s.id))
      const sisa = soalRef.current.filter(s => !ids.has(s.id))
      soalRef.current = sisa
      setSoal(sisa)
      perbaruiStatus()
      throw new Error('Soal gagal disimpan. Coba impor lagi.')
    }
  }, [antre, sentuh, perbaruiStatus])

  const value = useMemo<FormulirContextValue>(() => ({
    daftar, memuat, aktif, soal, memuatSoal, statusSimpan,
    pilihFormulir, buatFormulir, ubahFormulir, hapusFormulir,
    tambahSoal, ubahSoal, hapusSoal, duplikatSoal, pindahSoal, imporSoal,
    simpanSekarang, cobaSimpanLagi,
  }), [daftar, memuat, aktif, soal, memuatSoal, statusSimpan,
    pilihFormulir, buatFormulir, ubahFormulir, hapusFormulir,
    tambahSoal, ubahSoal, hapusSoal, duplikatSoal, pindahSoal, imporSoal,
    simpanSekarang, cobaSimpanLagi])

  return <FormulirContext.Provider value={value}>{children}</FormulirContext.Provider>
}

export function useFormulir(): FormulirContextValue {
  const ctx = useContext(FormulirContext)
  if (!ctx) throw new Error('useFormulir harus digunakan dalam FormulirProvider')
  return ctx
}
