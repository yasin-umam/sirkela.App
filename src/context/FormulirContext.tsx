import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Formulir, IsiSoal, Soal } from '../types'
import { supabase } from '../lib/supabase'
import type { DbBankSoal, DbFormulir } from '../lib/supabase'
import { buatUuid, masalahFormulir } from '../lib/soal'
import { useAuth } from './AuthContext'

// ─── Formulir & soalnya, disimpan MANUAL ──────────────────────────────────────
// Sampai 2026-09-23 ini "simpan otomatis ala Google Form" (tiap ketikan/tambah/
// hapus langsung ke database lewat antrean debounce). Diganti atas permintaan
// pemilik produk: sekarang layar HANYA menulis ke state lokal; tidak ada apa pun
// yang menyentuh database sampai guru menekan Simpan (atau Kirim, yang memanggil
// Simpan sendiri sebelum membuka sesi -- lihat DialogKirim).
//
// `soalAsliRef`/`formAsliRef` menyimpan CUPLIKAN terakhir yang diketahui sama
// dengan database (baru dimuat, atau baru berhasil disimpan). `punyaPerubahan`
// membandingkan state lokal terhadap cuplikan itu untuk tahu ada yang "kotor"
// atau tidak -- dipakai indikator Simpan DAN peringatan keluar (EditorFormulir).
//
// `belumTersimpanRef` menandai formulir yang baru dibuat DI KLIEN (id dibuat di
// sini, bukan menunggu server) dan belum pernah punya baris di tabel `formulir`
// -- Simpan pertama untuk formulir begini INSERT, sesudahnya UPDATE.

const KUNCI_TERAKHIR = 'sesi-soal:formulir_terakhir'

export type StatusSimpan = 'tersimpan' | 'menyimpan' | 'gagal'
export type UbahanFormulir = Partial<Pick<Formulir, 'judul' | 'deskripsi' | 'kelas' | 'mapel' | 'durasiMenit' | 'kunciLayar'>>
export interface RingkasFormulir extends Formulir { jumlahSoal: number }

interface FormulirContextValue {
  daftar: RingkasFormulir[]
  memuat: boolean
  aktif: Formulir | null
  soal: Soal[]
  memuatSoal: boolean
  statusSimpan: StatusSimpan
  /** Alasan Simpan terakhir gagal (validasi ATAU jaringan). null kalau belum pernah/berhasil. */
  galatSimpan: string | null
  /** Ada perubahan lokal (soal atau judul/deskripsi/dst) yang belum ditulis ke database. */
  punyaPerubahan: boolean
  pilihFormulir: (id: string) => void
  /** TIDAK menyentuh database -- formulirnya baru benar-benar lahir saat Simpan. */
  buatFormulir: (awal?: UbahanFormulir) => Promise<string>
  ubahFormulir: (ubahan: UbahanFormulir) => void
  /** MELEMPAR kalau gagal. Aksi langsung (dikonfirmasi terpisah), bukan bagian dari Simpan. */
  hapusFormulir: (id: string) => Promise<void>
  /** Mengembalikan id soal baru SEKETIKA. Cuma di state lokal -- lihat simpanSekarang. */
  tambahSoal: (posisi: number, isi?: Partial<IsiSoal>, id?: string) => string
  ubahSoal: (id: string, ubahan: Partial<IsiSoal>) => void
  /** Mengembalikan soal & posisinya, untuk "Urungkan". */
  hapusSoal: (id: string) => { soal: Soal; posisi: number } | null
  duplikatSoal: (id: string) => string | null
  pindahSoal: (id: string, arah: -1 | 1) => void
  /** Menambah di akhir formulir aktif, cuma di state lokal. */
  imporSoal: (daftarSoal: IsiSoal[]) => Promise<void>
  /** Membuang perubahan lokal formulir aktif, kembali ke cuplikan terakhir yang tersimpan. */
  batalkanPerubahan: () => void
  /** Menulis SEMUA perubahan lokal formulir aktif ke database. `false` = gagal. */
  simpanSekarang: () => Promise<boolean>
}

const FormulirContext = createContext<FormulirContextValue | null>(null)

function petakanFormulir(r: DbFormulir): Formulir {
  return {
    id: r.id, judul: r.judul, deskripsi: r.deskripsi, kelas: r.kelas, mapel: r.mapel,
    durasiMenit: r.durasi_menit, kunciLayar: r.kunci_layar,
    dibuatPada: r.created_at, diperbaruiPada: r.diperbarui_pada,
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
  if (u.kelas !== undefined) b.kelas = u.kelas
  if (u.mapel !== undefined) b.mapel = u.mapel
  if (u.durasiMenit !== undefined) b.durasi_menit = u.durasiMenit
  if (u.kunciLayar !== undefined) b.kunci_layar = u.kunciLayar
  return b
}

function barisSoal(u: Partial<IsiSoal>): Partial<DbBankSoal> {
  const b: Partial<DbBankSoal> = {}
  if (u.pertanyaan !== undefined) b.pertanyaan = u.pertanyaan
  if (u.pilihan !== undefined) b.pilihan = u.pilihan
  if (u.jawabanBenar !== undefined) b.jawaban_benar = u.jawabanBenar
  return b
}

/** urutan = posisi. */
function nomoriUlang(list: Soal[]): Soal[] {
  return list.map((s, i) => s.urutan === i ? s : { ...s, urutan: i })
}

function cuplikForm(f: Formulir): Required<UbahanFormulir> {
  return {
    judul: f.judul, deskripsi: f.deskripsi, kelas: f.kelas, mapel: f.mapel,
    durasiMenit: f.durasiMenit, kunciLayar: f.kunciLayar,
  }
}

function samaFormulir(a: Required<UbahanFormulir>, b: Required<UbahanFormulir>): boolean {
  return a.judul === b.judul && a.deskripsi === b.deskripsi && a.kelas === b.kelas && a.mapel === b.mapel
    && a.durasiMenit === b.durasiMenit && a.kunciLayar === b.kunciLayar
}

function samaSoal(a: Soal[], b: Soal[]): boolean {
  if (a.length !== b.length) return false
  const tanda = (s: Soal) => `${s.pertanyaan}\u0001${s.pilihan.join('\u0002')}\u0001${s.jawabanBenar}\u0001${s.urutan}`
  const urutkan = (arr: Soal[]) => [...arr].sort((x, y) => x.id.localeCompare(y.id))
  const sa = urutkan(a), sb = urutkan(b)
  return sa.every((s, i) => s.id === sb[i].id && tanda(s) === tanda(sb[i]))
}

function bacaTerakhir(): string | null {
  try { return localStorage.getItem(KUNCI_TERAKHIR) } catch { return null }
}
function tulisTerakhir(id: string) {
  try { localStorage.setItem(KUNCI_TERAKHIR, id) } catch { /* mode privat */ }
}

export function FormulirProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_UJI_TAMPILAN) {
    const aktif: Formulir = {
      id: 'f1', judul: 'Ulangan Harian Bab 3', deskripsi: '', kelas: '7A', mapel: 'Matematika',
      durasiMenit: 45, kunciLayar: false,
      dibuatPada: new Date().toISOString(), diperbaruiPada: new Date().toISOString(),
    }
    const soal: Soal[] = [
      { id: 's1', formulirId: 'f1', pertanyaan: 'Berapa hasil dari 6 x 7?', pilihan: ['40', '42', '44', '46'], jawabanBenar: 1, urutan: 0 },
      { id: 's2', formulirId: 'f1', pertanyaan: 'Ibu kota Indonesia adalah?', pilihan: ['Bandung', 'Jakarta', 'Surabaya'], jawabanBenar: 1, urutan: 1 },
    ]
    const value: FormulirContextValue = {
      daftar: [{ ...aktif, jumlahSoal: soal.length }], memuat: false, aktif, soal, memuatSoal: false,
      statusSimpan: 'tersimpan', galatSimpan: null, punyaPerubahan: false,
      pilihFormulir: () => {}, buatFormulir: async () => aktif.id, ubahFormulir: () => {},
      hapusFormulir: async () => {}, tambahSoal: () => '', ubahSoal: () => {}, hapusSoal: () => null,
      duplikatSoal: () => null, pindahSoal: () => {}, imporSoal: async () => {},
      batalkanPerubahan: () => {}, simpanSekarang: async () => true,
    }
    return <FormulirContext.Provider value={value}>{children}</FormulirContext.Provider>
  }

  const { user } = useAuth()
  const [daftarMentah, setDaftarMentah] = useState<RingkasFormulir[]>([])
  const [memuat, setMemuat] = useState(false)
  const [aktifId, setAktifId] = useState<string | null>(null)
  const [soal, setSoal] = useState<Soal[]>([])
  const [memuatSoal, setMemuatSoal] = useState(false)
  const [statusSimpan, setStatusSimpan] = useState<StatusSimpan>('tersimpan')
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null)

  // Cermin state untuk operasi baca-ubah-tulis beruntun (dua ketukan cepat
  // "tambah soal" tidak boleh sama-sama membaca daftar lama).
  const soalRef = useRef<Soal[]>([])
  soalRef.current = soal
  const aktifIdRef = useRef<string | null>(null)
  aktifIdRef.current = aktifId
  const daftarRef = useRef<RingkasFormulir[]>([])
  daftarRef.current = daftarMentah

  // Cuplikan terakhir yang SAMA dengan database -- baru dimuat, atau baru
  // berhasil Simpan. Soal/formulir baru (belum pernah disimpan) cuplikannya
  // kosong/nilai bawaan, jadi "kotor" begitu diisi apa pun -- bukan seketika
  // dibuat.
  const soalAsliRef = useRef<Soal[]>([])
  const formAsliRef = useRef<Required<UbahanFormulir> | null>(null)
  /** Formulir yang id-nya dibuat di klien dan belum pernah punya baris di server. */
  const belumTersimpanRef = useRef(new Set<string>())
  const simpanPromiseRef = useRef<Promise<boolean> | null>(null)

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
        const dipetakan = ((data ?? []) as DbBankSoal[]).map(petakanSoal)
        setSoal(dipetakan)
        soalAsliRef.current = dipetakan.map(s => ({ ...s }))
        setMemuatSoal(false)
      })
  }, [])

  const aktifkan = useCallback((id: string | null, opsi?: { kosong?: boolean }) => {
    // Ref diperbarui SEKARANG, bukan menunggu render: `await buatFormulir()` lalu
    // langsung `imporSoal()` harus sudah melihat formulir yang baru.
    aktifIdRef.current = id
    setAktifId(id)
    setStatusSimpan('tersimpan')
    setGalatSimpan(null)
    if (!id) {
      ++nomorMuat.current; soalRef.current = []; setSoal([]); setMemuatSoal(false)
      soalAsliRef.current = []; formAsliRef.current = null
      return
    }
    tulisTerakhir(id)
    const f = daftarRef.current.find(x => x.id === id)
    formAsliRef.current = f ? cuplikForm(f) : null
    if (opsi?.kosong) {
      // Formulir yang BARU dibuat pasti kosong. Tanpa jalan pintas ini, fetch-nya
      // bisa sampai SETELAH soal impor ditambahkan dan menimpanya dengan [].
      ++nomorMuat.current
      soalRef.current = []
      setSoal([])
      setMemuatSoal(false)
      soalAsliRef.current = []
    } else {
      muatSoal(id)
    }
  }, [muatSoal])

  useEffect(() => {
    setDaftarMentah([])
    setAktifId(null)
    setSoal([])
    belumTersimpanRef.current.clear()
    // kepala_sekolah tetap guru mapel biasa untuk formulirnya sendiri
    // (2026-09-24) -- cuma murid yang tidak pernah punya formulir.
    if (!user || user.role === 'murid') return
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
        daftarRef.current = list
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

  // Dihitung tiap render (bukan useMemo): ref-nya (soalAsliRef/formAsliRef)
  // berubah di luar siklus state React (baru dimuat, baru disimpan), dan
  // useMemo yang bergantung padanya akan membaca nilai basi sampai state lain
  // ikut berubah. Perbandingannya murah -- aman dihitung ulang tiap render.
  const punyaPerubahan = aktifId !== null && aktif !== null && formAsliRef.current !== null
    && (!samaFormulir(cuplikForm(aktif), formAsliRef.current) || !samaSoal(soal, soalAsliRef.current))

  const sentuh = useCallback((id: string, ubahan: UbahanFormulir = {}) => {
    const kini = new Date().toISOString()
    setDaftarMentah(prev => prev.map(f => f.id === id ? { ...f, ...ubahan, diperbaruiPada: kini } : f))
  }, [])

  // ── Formulir ──
  const pilihFormulir = useCallback((id: string) => {
    if (id !== aktifIdRef.current) aktifkan(id)
  }, [aktifkan])

  const buatFormulir = useCallback(async (awal: UbahanFormulir = {}) => {
    const id = buatUuid()
    const kini = new Date().toISOString()
    const baru: RingkasFormulir = {
      id,
      judul: awal.judul ?? 'Formulir tanpa judul',
      deskripsi: awal.deskripsi ?? '',
      kelas: awal.kelas ?? '',
      mapel: awal.mapel ?? '',
      durasiMenit: awal.durasiMenit ?? 45,
      kunciLayar: awal.kunciLayar ?? false,
      dibuatPada: kini, diperbaruiPada: kini, jumlahSoal: 0,
    }
    belumTersimpanRef.current.add(id)
    daftarRef.current = [baru, ...daftarRef.current]
    setDaftarMentah(daftarRef.current)
    aktifkan(id, { kosong: true })
    return id
  }, [aktifkan])

  const ubahFormulir = useCallback((ubahan: UbahanFormulir) => {
    const id = aktifIdRef.current
    if (!id) return
    sentuh(id, ubahan)
  }, [sentuh])

  const hapusFormulir = useCallback(async (id: string) => {
    if (!belumTersimpanRef.current.has(id)) {
      const { error } = await supabase.from('formulir').delete().eq('id', id)
      if (error) throw new Error(error.message)
    }
    belumTersimpanRef.current.delete(id)
    const sisa = daftarRef.current.filter(f => f.id !== id)
    daftarRef.current = sisa
    setDaftarMentah(sisa)
    if (id === aktifIdRef.current) {
      const berikutnya = [...sisa].sort((a, b) => b.diperbaruiPada.localeCompare(a.diperbaruiPada))[0]
      aktifkan(berikutnya?.id ?? null)
    }
  }, [aktifkan])

  // ── Soal (semua LOKAL -- lihat simpanSekarang untuk penulisan sungguhan) ──
  const terapkanUrutan = useCallback((list: Soal[]) => {
    const bernomor = nomoriUlang(list)
    setSoal(bernomor)
    soalRef.current = bernomor
    return bernomor
  }, [])

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
    terapkanUrutan(list)
    sentuh(formulirId)
    return id
  }, [terapkanUrutan, sentuh])

  const ubahSoal = useCallback((id: string, ubahan: Partial<IsiSoal>) => {
    const baru = soalRef.current.map(s => s.id === id ? { ...s, ...ubahan } : s)
    soalRef.current = baru
    setSoal(baru)
    if (aktifIdRef.current) sentuh(aktifIdRef.current)
  }, [sentuh])

  const hapusSoal = useCallback((id: string) => {
    const posisi = soalRef.current.findIndex(s => s.id === id)
    if (posisi === -1) return null
    const dihapus = soalRef.current[posisi]
    terapkanUrutan(soalRef.current.filter(s => s.id !== id))
    if (aktifIdRef.current) sentuh(aktifIdRef.current)
    return { soal: dihapus, posisi }
  }, [terapkanUrutan, sentuh])

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
  }, [sentuh])

  const batalkanPerubahan = useCallback(() => {
    const id = aktifIdRef.current
    if (!id) return
    if (belumTersimpanRef.current.has(id)) {
      // Belum pernah ada di server -- buang seluruh draftnya, bukan cuma isinya.
      belumTersimpanRef.current.delete(id)
      const sisa = daftarRef.current.filter(f => f.id !== id)
      daftarRef.current = sisa
      setDaftarMentah(sisa)
      const berikutnya = [...sisa].sort((a, b) => b.diperbaruiPada.localeCompare(a.diperbaruiPada))[0]
      aktifkan(berikutnya?.id ?? null)
      return
    }
    const asli = soalAsliRef.current.map(s => ({ ...s }))
    soalRef.current = asli
    setSoal(asli)
    if (formAsliRef.current) {
      const patch = formAsliRef.current
      daftarRef.current = daftarRef.current.map(f => f.id === id ? { ...f, ...patch } : f)
      setDaftarMentah(daftarRef.current)
    }
  }, [aktifkan])

  // ── Simpan: satu-satunya jalan tulis ke database ──
  const lakukanSimpan = useCallback(async (): Promise<boolean> => {
    const formulirId = aktifIdRef.current
    if (!formulirId) return true
    setStatusSimpan('menyimpan')
    setGalatSimpan(null)
    try {
      const formSekarang = daftarRef.current.find(f => f.id === formulirId)
      if (!formSekarang) throw new Error('Formulir tidak ditemukan')
      const masalah = masalahFormulir(formSekarang)
      if (masalah) throw new Error(masalah.charAt(0).toUpperCase() + masalah.slice(1))
      const cuplikan = cuplikForm(formSekarang)

      if (belumTersimpanRef.current.has(formulirId)) {
        const { error } = await supabase.from('formulir').insert({ id: formulirId, ...barisFormulir(cuplikan) })
        if (error) throw new Error(error.message)
        belumTersimpanRef.current.delete(formulirId)
      } else if (formAsliRef.current && !samaFormulir(cuplikan, formAsliRef.current)) {
        const { error } = await supabase.from('formulir').update(barisFormulir(cuplikan)).eq('id', formulirId)
        if (error) throw new Error(error.message)
      }

      const soalSekarang = soalRef.current
      const asli = soalAsliRef.current
      const asliMap = new Map(asli.map(s => [s.id, s]))
      const sekarangMap = new Map(soalSekarang.map(s => [s.id, s]))

      const baru = soalSekarang.filter(s => !asliMap.has(s.id))
      const hapusIds = asli.filter(s => !sekarangMap.has(s.id)).map(s => s.id)
      const ubah = soalSekarang.filter(s => {
        const lama = asliMap.get(s.id)
        if (!lama) return false
        return lama.pertanyaan !== s.pertanyaan || lama.jawabanBenar !== s.jawabanBenar
          || lama.urutan !== s.urutan || lama.pilihan.length !== s.pilihan.length
          || lama.pilihan.some((p, i) => p !== s.pilihan[i])
      })

      if (baru.length) {
        const { error } = await supabase.from('bank_soal').insert(baru.map(s => ({
          id: s.id, formulir_id: formulirId, urutan: s.urutan, ...barisSoal(s),
        })))
        if (error) throw new Error(error.message)
      }
      if (hapusIds.length) {
        const { error } = await supabase.from('bank_soal').delete().in('id', hapusIds)
        if (error) throw new Error(error.message)
      }
      if (ubah.length) {
        const hasil = await Promise.all(ubah.map(s => supabase.from('bank_soal')
          .update({ urutan: s.urutan, ...barisSoal(s) }).eq('id', s.id)))
        const salah = hasil.find(h => h.error)
        if (salah?.error) throw new Error(salah.error.message)
      }

      soalAsliRef.current = soalSekarang.map(s => ({ ...s }))
      formAsliRef.current = cuplikan
      setStatusSimpan('tersimpan')
      return true
    } catch (e) {
      const pesan = e instanceof Error ? e.message : 'Gagal menyimpan'
      console.error('[simpan]', pesan)
      setStatusSimpan('gagal')
      setGalatSimpan(pesan)
      return false
    }
  }, [])

  const simpanSekarang = useCallback((): Promise<boolean> => {
    // Simpan ganda (mis. tombol Simpan diketuk dua kali, atau Kirim menyusul
    // Simpan yang masih berjalan) menunggu operasi yang SAMA, bukan mengirim
    // dua kali dan bisa menggandakan insert soal baru.
    if (simpanPromiseRef.current) return simpanPromiseRef.current
    const p = lakukanSimpan().finally(() => { simpanPromiseRef.current = null })
    simpanPromiseRef.current = p
    return p
  }, [lakukanSimpan])

  // Tab ditutup/di-refresh dengan perubahan belum tersimpan -- browser yang
  // menampilkan dialognya sendiri (teks kustom tidak lagi didukung browser modern).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!punyaPerubahan) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [punyaPerubahan])

  const value = useMemo<FormulirContextValue>(() => ({
    daftar, memuat, aktif, soal, memuatSoal, statusSimpan, galatSimpan, punyaPerubahan,
    pilihFormulir, buatFormulir, ubahFormulir, hapusFormulir,
    tambahSoal, ubahSoal, hapusSoal, duplikatSoal, pindahSoal, imporSoal,
    batalkanPerubahan, simpanSekarang,
  }), [daftar, memuat, aktif, soal, memuatSoal, statusSimpan, galatSimpan, punyaPerubahan,
    pilihFormulir, buatFormulir, ubahFormulir, hapusFormulir,
    tambahSoal, ubahSoal, hapusSoal, duplikatSoal, pindahSoal, imporSoal,
    batalkanPerubahan, simpanSekarang])

  return <FormulirContext.Provider value={value}>{children}</FormulirContext.Provider>
}

export function useFormulir(): FormulirContextValue {
  const ctx = useContext(FormulirContext)
  if (!ctx) throw new Error('useFormulir harus digunakan dalam FormulirProvider')
  return ctx
}
