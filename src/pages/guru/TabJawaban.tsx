import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HasilSoal, PesertaSesi, SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { bacaHasilSoalSesi, ratakanSoalGuru, vetoNilaiSesi, type JawabanSoalMurid } from '../../lib/sesiGuru'
import { jamMenit, labelWaktu } from '../../lib/soal'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Sakelar } from '../../components/ui/Sakelar'
import { BagikanSesi } from '../../components/BagikanSesi'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'

// ─── Tab Jawaban ─────────────────────────────────────────────────────────────
// Padanan tab "Jawaban" Google Form, dengan satu perbedaan: jawaban di sini
// datang PER SESI (satu kali Kirim = satu sesi = satu kode). Pemilih sesi di
// atas; di bawahnya kendali sesi, lalu Ringkasan & daftar Murid.
//
// Benar/salah dihitung ULANG di klien dari kunci milik guru, MURNI untuk
// ditampilkan; nilai tersimpan tetap hasil selesaikan_murid() sampai guru
// menyimpan veto.

const AMBANG_SENYAP_MS = 45_000 // dua kali jarak denyut murid (20 detik)
const JEDA_MUAT_ULANG_MS = 10_000

function labelSesi(s: SesiKelas): string {
  const status = s.status === 'selesai' ? 'Selesai' : s.mulaiPada ? 'Berjalan' : 'Menunggu dimulai'
  return `${s.kodeJoin} · ${status} · ${labelWaktu(s.dibuatPada)} ${jamMenit(s.dibuatPada)}`
}

function durasiSingkat(ms: number): string {
  const detik = Math.max(0, Math.round(ms / 1000))
  const menit = Math.floor(detik / 60)
  return menit > 0 ? `${menit}:${String(detik % 60).padStart(2, '0')}` : `${detik} dtk`
}

export function TabJawaban({ sesiList, kosong }: {
  /** Sesi yang boleh dipilih di tab ini (sesi formulir aktif, atau arsip). */
  sesiList: SesiKelas[]
  /** Isi kartu saat belum ada sesi. */
  kosong: React.ReactNode
}) {
  const { fokus, fokuskan } = useSesi()

  // Fokus yang bukan milik daftar ini (pindah formulir) diganti: sesi yang masih
  // aktif dulu, baru yang terbaru.
  useEffect(() => {
    if (fokus && sesiList.some(s => s.id === fokus.id)) return
    const pilihan = sesiList.find(s => s.status === 'aktif') ?? sesiList[0]
    fokuskan(pilihan?.id ?? null)
  }, [fokus, sesiList, fokuskan])

  if (sesiList.length === 0) {
    return (
      <div className="max-w-192.5 mx-auto px-3 py-3 desktop:py-6">
        <div className="bg-white rounded-lg border border-garis px-5 py-10 flex flex-col items-center gap-3 text-center">{kosong}</div>
      </div>
    )
  }

  const pemilih = sesiList.length > 1 && (
    <label className="relative flex items-center">
      <span className="sr-only">Pilih sesi</span>
      <select value={fokus?.id ?? ''} onChange={e => fokuskan(e.target.value)}
        className="w-full appearance-none bg-isian rounded-md border border-garis pl-3 pr-9 py-2 text-sm text-teks outline-none focus:border-indigo-600">
        {sesiList.map(s => <option key={s.id} value={s.id}>{labelSesi(s)}</option>)}
      </select>
      <Ikon nama="bawah" className="w-5 h-5 text-teks-2 absolute right-2 pointer-events-none" />
    </label>
  )

  return (
    <div className="max-w-192.5 mx-auto px-3 py-3 desktop:py-6">
      {fokus && sesiList.some(s => s.id === fokus.id) && <PanelSesi key={fokus.id} sesi={fokus} pemilih={pemilih} />}
    </div>
  )
}

// ─── Satu sesi ───────────────────────────────────────────────────────────────

function PanelSesi({ sesi, pemilih }: { sesi: SesiKelas; pemilih: React.ReactNode }) {
  const { mulaiSesi, akhiriSesi } = useSesi()
  const [hasil, setHasil] = useState<JawabanSoalMurid[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [tampilan, setTampilan] = useState<'ringkasan' | 'murid'>('ringkasan')
  const [konfirmasiAkhiri, setKonfirmasiAkhiri] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galatAksi, setGalatAksi] = useState<string | null>(null)

  const soalList = useMemo(() => ratakanSoalGuru(sesi.kontenList), [sesi.kontenList])
  const aktif = sesi.status === 'aktif'

  // Peserta dibaca lewat ref, BUKAN dependensi: Realtime memperbarui daftar
  // peserta tiap denyut (20 detik), dan memuat ulang tiap denyut menutup kartu
  // murid yang sedang dibuka guru. Murid BARU bergabung tetap memicu muat ulang.
  const pesertaRef = useRef(sesi.muridJoined)
  pesertaRef.current = sesi.muridJoined
  const muat = useCallback(() => {
    bacaHasilSoalSesi(sesi.id, pesertaRef.current)
      .then(h => { setHasil(h); setGalat(null) })
      .catch(e => { setHasil(prev => prev ?? []); setGalat(e instanceof Error ? e.message : 'Gagal memuat jawaban') })
  }, [sesi.id])
  useEffect(() => { muat() }, [muat, sesi.muridJoined.length])
  // Nilai lahir di perangkat murid (selesaikan_murid) tanpa Realtime ke guru.
  useEffect(() => {
    if (!aktif) return
    const id = setInterval(muat, JEDA_MUAT_ULANG_MS)
    return () => clearInterval(id)
  }, [aktif, muat])

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalatAksi(null)
    try { await aksi() } catch (e) { setGalatAksi(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  async function veto(nilaiId: string, nilaiBaru: number) {
    await vetoNilaiSesi(nilaiId, nilaiBaru)
    setHasil(prev => prev?.map(m => (m.nilaiId === nilaiId ? { ...m, nilai: nilaiBaru, diubahGuru: true } : m)) ?? prev)
  }

  const hasilPer = new Map((hasil ?? []).map(h => [h.muridId, h]))
  const mengirim = (hasil ?? []).filter(h => h.nilai != null)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Kepala: jumlah jawaban, status, kendali ── */}
      <div className="bg-white rounded-lg border border-garis">
        <div className="px-5 desktop:px-6 pt-5 pb-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[28px] leading-tight text-teks">{mengirim.length} jawaban</p>
              <p className="text-sm text-teks-2 mt-1">
                {sesi.muridJoined.length} murid bergabung · {soalList.length} soal · {sesi.durasiMenit} menit
              </p>
            </div>
            <ChipStatus sesi={sesi} />
          </div>
          {pemilih}

          {aktif && sesi.mulaiPada && <Hitungan mulaiPada={sesi.mulaiPada} durasiMenit={sesi.durasiMenit} />}

          {aktif ? (
            <div className="flex flex-wrap items-center gap-2">
              {!sesi.mulaiPada && (
                <Button onClick={() => void jalankan(() => mulaiSesi(sesi.id))} disabled={sibuk}>Mulai sesi</Button>
              )}
              <Button variant="secondary" onClick={() => setKonfirmasiAkhiri(true)} disabled={sibuk}
                className="text-salah! hover:bg-red-50!">
                Akhiri sesi
              </Button>
              {!sesi.mulaiPada && (
                <p className="text-xs text-teks-2 basis-full">Murid sudah bisa bergabung. Hitung mundur dimulai saat kamu menekan Mulai sesi.</p>
              )}
            </div>
          ) : sesi.selesaiPada && (
            <p className="text-sm text-teks-2">Diakhiri {labelWaktu(sesi.selesaiPada).toLowerCase()} pukul {jamMenit(sesi.selesaiPada)}. Nilai masih bisa diveto.</p>
          )}
          {galatAksi && <p className="text-sm text-salah">{galatAksi}</p>}
        </div>

        {aktif && (
          <div className="border-t border-garis px-5 desktop:px-6 py-4">
            <BagikanSesi kode={sesi.kodeJoin} />
          </div>
        )}
        {aktif && <KendaliKunci sesi={sesi} />}

        <nav className="border-t border-garis flex justify-center gap-6">
          {([['ringkasan', 'Ringkasan'], ['murid', `Murid (${sesi.muridJoined.length})`]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTampilan(id)}
              className={`relative h-12 px-3 text-sm font-medium ${tampilan === id ? 'text-indigo-600' : 'text-teks-2 hover:text-teks'}`}>
              {label}
              {tampilan === id && <span className="absolute left-1 right-1 bottom-0 h-0.75 rounded-t bg-indigo-600" />}
            </button>
          ))}
        </nav>
      </div>

      {galat && (
        <div className="flex items-center gap-2 rounded-lg border border-salah bg-white px-5 py-3 text-sm text-salah">
          <span className="flex-1">{galat}</span>
          <Button variant="teks" size="sm" onClick={muat}>Coba lagi</Button>
        </div>
      )}

      {hasil === null ? (
        <div className="py-16 flex justify-center text-indigo-600"><Spinner size={28} /></div>
      ) : tampilan === 'ringkasan' ? (
        <Ringkasan soalList={soalList} hasil={hasil} />
      ) : sesi.muridJoined.length === 0 ? (
        <div className="bg-white rounded-lg border border-garis px-5 py-10 text-center text-sm text-teks-2">
          Belum ada murid yang bergabung.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-garis divide-y divide-garis">
          {urutkanPeserta(sesi).map(p => (
            <BarisMurid key={p.muridId} peserta={p} hasil={hasilPer.get(p.muridId)} soalList={soalList}
              sesi={sesi} onVeto={veto} />
          ))}
        </div>
      )}

      {konfirmasiAkhiri && (
        <LembarKonfirmasi
          judul="Akhiri sesi sekarang?"
          pesan="HP murid yang masih membuka sesi ini mengirim otomatis jawaban yang sudah dipilih. Murid yang sudah menutup aplikasinya tidak mendapat nilai. Kode sesi tidak bisa dipakai lagi."
          labelAksi="Akhiri"
          sibuk={sibuk}
          onAksi={() => void jalankan(() => akhiriSesi(sesi.id)).then(() => setKonfirmasiAkhiri(false))}
          onBatal={() => setKonfirmasiAkhiri(false)}
        />
      )}
    </div>
  )
}

/** Yang terkunci dulu -- guru sedang ditunggu mereka. Sisanya urutan bergabung. */
function urutkanPeserta(sesi: SesiKelas): PesertaSesi[] {
  if (!sesi.kunciLayar) return sesi.muridJoined
  return [...sesi.muridJoined].sort((a, b) => Number(b.terkunciPada !== null) - Number(a.terkunciPada !== null))
}

function ChipStatus({ sesi }: { sesi: SesiKelas }) {
  const [label, warna] = sesi.status === 'selesai'
    ? ['Selesai', 'bg-slate-100 text-teks-2']
    : sesi.mulaiPada ? ['Berjalan', 'bg-green-50 text-benar'] : ['Menunggu', 'bg-amber-50 text-amber-700']
  return <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${warna}`}>{label}</span>
}

function Hitungan({ mulaiPada, durasiMenit }: { mulaiPada: string; durasiMenit: number }) {
  // Tenggat diturunkan dari mulai_pada + durasi -- aturan yang sama dengan sesi_tenggat() di DB.
  const tenggatMs = new Date(mulaiPada).getTime() + durasiMenit * 60_000
  const hitung = () => Math.max(0, Math.round((tenggatMs - Date.now()) / 1000))
  const [sisa, setSisa] = useState(hitung)
  useEffect(() => {
    // Dihitung ulang dari tenggat tiap tick, BUKAN dikurangi 1: browser
    // men-throttle setInterval saat tab di-background.
    const id = setInterval(() => setSisa(hitung()), 1000)
    return () => clearInterval(id)
  }, [tenggatMs]) // eslint-disable-line react-hooks/exhaustive-deps

  const persen = (sisa / (durasiMenit * 60)) * 100
  const mepet = persen < 20
  return (
    <div className="flex items-center gap-3">
      <span className={`font-mono text-2xl font-medium ${mepet ? 'text-salah' : 'text-teks'}`}>
        {String(Math.floor(sisa / 60)).padStart(2, '0')}:{String(sisa % 60).padStart(2, '0')}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${mepet ? 'bg-salah' : 'bg-indigo-600'}`} style={{ width: `${persen}%` }} />
      </div>
      <span className="text-xs text-teks-2">{sisa === 0 ? 'Waktu habis' : 'tersisa'}</span>
    </div>
  )
}

// ─── Kunci layar di sesi berjalan ────────────────────────────────────────────
// Mematikan = membebaskan semua yang sedang terkunci. "Buka semua" = jalan keluar
// yang sama tanpa mematikan kuncinya. Keduanya dua langkah: layar guru sering
// tampil di papan tulis pintar.

function KendaliKunci({ sesi }: { sesi: SesiKelas }) {
  const { aturKunciLayar, bukaKunciSemua } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false); setKonfirmasi(false) }
  }

  return (
    <div className="border-t border-garis px-5 desktop:px-6 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-teks">Kunci layar murid</p>
          <p className="text-sm text-teks-2 mt-0.5">Mematikannya membebaskan semua murid yang sedang terkunci.</p>
        </div>
        <Sakelar label="Kunci layar murid" aktif={sesi.kunciLayar} disabled={sibuk}
          onUbah={v => void jalankan(() => aturKunciLayar(sesi.id, v))} />
      </div>
      {terkunci > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
          <Ikon nama="kunci" className="w-5 h-5 text-amber-700" />
          <p className="flex-1 text-sm text-amber-900"><strong className="font-medium">{terkunci} murid</strong> sedang terkunci</p>
          {konfirmasi ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={sibuk}>Batal</Button>
              <Button size="sm" onClick={() => void jalankan(() => bukaKunciSemua(sesi.id))} disabled={sibuk}>
                {sibuk ? '...' : 'Ya, buka semua'}
              </Button>
            </>
          ) : (
            <Button variant="teks" size="sm" onClick={() => setKonfirmasi(true)}>Buka semua</Button>
          )}
        </div>
      )}
      {galat && <p className="text-sm text-salah">{galat}</p>}
    </div>
  )
}

// ─── Ringkasan per soal ──────────────────────────────────────────────────────

function Ringkasan({ soalList, hasil }: { soalList: HasilSoal[]; hasil: JawabanSoalMurid[] }) {
  const nilai = hasil.map(h => h.nilai).filter((n): n is number => n != null)
  const rata = nilai.length ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-lg border border-garis px-5 desktop:px-6 py-5">
        <h3 className="text-lg text-teks">Nilai</h3>
        {nilai.length === 0 ? (
          <p className="text-sm text-teks-2 mt-2">Belum ada murid yang mengirim jawaban.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {([['Rata-rata', rata], ['Tertinggi', Math.max(...nilai)], ['Terendah', Math.min(...nilai)]] as const).map(([label, n]) => (
              <div key={label}>
                <p className="text-2xl text-teks">{n}</p>
                <p className="text-xs text-teks-2 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {soalList.map((s, i) => {
        // Hanya murid yang MENJAWAB soal ini -- yang kosong bukan "salah" di sini.
        const pilihanMurid = hasil.map(h => h.jawaban[s.id]).filter((j): j is number => j !== undefined)
        const benar = pilihanMurid.filter(j => j === s.jawabanBenar).length
        return (
          <div key={s.id} className="bg-white rounded-lg border border-garis px-5 desktop:px-6 py-5">
            <p className="text-base text-teks whitespace-pre-wrap break-words">
              <span className="text-teks-2">{i + 1}. </span>{s.pertanyaan}
            </p>
            <p className="text-xs text-teks-2 mt-1">
              {pilihanMurid.length === 0 ? 'Belum ada yang menjawab' : `${benar} dari ${pilihanMurid.length} jawaban benar`}
            </p>
            <div className="mt-3 flex flex-col gap-2.5">
              {s.pilihan.map((p, j) => {
                const jumlah = pilihanMurid.filter(x => x === j).length
                const persen = pilihanMurid.length ? Math.round((jumlah / pilihanMurid.length) * 100) : 0
                const kunci = j === s.jawabanBenar
                return (
                  <div key={j}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`flex-1 min-w-0 break-words ${kunci ? 'text-benar font-medium' : 'text-teks'}`}>{p}</span>
                      {kunci && <Ikon nama="centang" className="w-4 h-4 text-benar" />}
                      <span className="text-teks-2 tabular-nums">{jumlah} ({persen}%)</span>
                    </div>
                    <div className="mt-1 h-2 rounded-sm bg-slate-100 overflow-hidden">
                      <div className={`h-full ${kunci ? 'bg-benar' : 'bg-indigo-400'}`} style={{ width: `${persen}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Satu murid ──────────────────────────────────────────────────────────────
// Sinyal di sini KESAKSIAN, bukan tuduhan (A4). Yang tidak pernah bisa
// ditampilkan: aplikasi apa yang dibuka, isi layarnya, atau HP kedua.

function BarisMurid({ peserta, hasil, soalList, sesi, onVeto }: {
  peserta: PesertaSesi
  hasil: JawabanSoalMurid | undefined
  soalList: HasilSoal[]
  sesi: SesiKelas
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
}) {
  const { bukaKunciMurid } = useSesi()
  const [buka, setBuka] = useState(false)
  // Dirender ulang tiap 10 detik supaya label "senyap" muncul sendiri -- justru
  // ketiadaan event yang jadi sinyalnya.
  const [, tick] = useState(0)
  useEffect(() => {
    if (sesi.status !== 'aktif') return
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [sesi.status])
  const [konfirmasiBuka, setKonfirmasiBuka] = useState(false)
  const [membuka, setMembuka] = useState(false)
  const [gagalBuka, setGagalBuka] = useState(false)

  const aktif = sesi.status === 'aktif'
  const sudahKirim = hasil?.nilai != null
  // Kunci efektif = sesi masih berkunci. Mematikan sakelar membebaskan murid
  // walau barisnya belum tersiar ulang.
  const terkunci = aktif && sesi.kunciLayar && peserta.terkunciPada !== null
  const denyutMs = peserta.terakhirDenyut ? new Date(peserta.terakhirDenyut).getTime() : 0
  const senyap = !denyutMs || Date.now() - denyutMs > AMBANG_SENYAP_MS

  const sinyal = [
    peserta.keluarLayar > 0 && `${peserta.keluarLayar}× keluar layar`,
    peserta.hilangFokus > 0 && `${peserta.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')

  async function bukaKunci() {
    setMembuka(true); setGagalBuka(false)
    try {
      await bukaKunciMurid(sesi.id, peserta.muridId)
      setKonfirmasiBuka(false)
    } catch {
      setGagalBuka(true)
    } finally {
      setMembuka(false)
    }
  }

  const status = sudahKirim ? <span className="text-benar">Sudah mengirim</span>
    : !aktif ? <span>Tidak mengirim</span>
    : terkunci ? <span className="text-amber-700">Terkunci {durasiSingkat(Date.now() - new Date(peserta.terkunciPada!).getTime())}</span>
    : senyap ? <span>{denyutMs ? `Senyap ${Math.round((Date.now() - denyutMs) / 1000)} dtk` : 'Belum mulai'}</span>
    : <span className="text-benar">● Mengerjakan</span>

  return (
    <div className={terkunci ? 'bg-amber-50/60' : ''}>
      <div className="flex items-center gap-3 px-4 desktop:px-5 py-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-sm font-medium">
          {peserta.nama.charAt(0).toUpperCase()}
        </div>
        <button type="button" onClick={() => setBuka(v => !v)} className="flex-1 min-w-0 text-left">
          <p className="text-sm text-teks truncate">{peserta.nama}</p>
          <p className="text-xs text-teks-2">{status}{sinyal && <span className="text-amber-700"> · {sinyal}</span>}</p>
          {gagalBuka && <p className="text-xs text-salah">Gagal membuka kunci, coba lagi</p>}
        </button>

        {terkunci && (konfirmasiBuka ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setKonfirmasiBuka(false)} disabled={membuka}>Batal</Button>
            <Button size="sm" onClick={() => void bukaKunci()} disabled={membuka}>{membuka ? '...' : 'Ya, buka'}</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setKonfirmasiBuka(true)} className="shrink-0">
            <Ikon nama="kunci" className="w-4 h-4" />Buka
          </Button>
        ))}

        {sudahKirim && (
          <span className={`shrink-0 text-sm font-medium tabular-nums ${hasil!.diubahGuru ? 'text-amber-700' : 'text-teks'}`}
            title={hasil!.diubahGuru ? 'Diubah guru' : undefined}>
            {hasil!.nilai}{hasil!.diubahGuru && '*'}
          </span>
        )}
        <TombolIkon nama="bawah" label={buka ? 'Tutup jawaban' : 'Lihat jawaban'} onClick={() => setBuka(v => !v)}
          className={buka ? 'rotate-180' : ''} ukuran="w-5 h-5" />
      </div>

      {buka && <JawabanMurid hasil={hasil} soalList={soalList} onVeto={onVeto} />}
    </div>
  )
}

function JawabanMurid({ hasil, soalList, onVeto }: {
  hasil: JawabanSoalMurid | undefined
  soalList: HasilSoal[]
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
}) {
  const [nilaiTeks, setNilaiTeks] = useState(hasil?.nilai != null ? String(hasil.nilai) : '')
  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tersimpan, setTersimpan] = useState(false)
  const jawaban = hasil?.jawaban ?? {}
  const benar = soalList.filter(s => jawaban[s.id] === s.jawabanBenar).length

  async function simpan() {
    if (!hasil?.nilaiId) return
    const t = nilaiTeks.trim()
    const angka = Number(t)
    // Kolom nilai int dengan CHECK 0-100 -- pesan yang bisa dibaca, bukan error Postgres.
    if (t === '' || !Number.isInteger(angka) || angka < 0 || angka > 100) {
      setError('Nilai harus bilangan bulat 0–100')
      return
    }
    setMenyimpan(true); setError(null)
    try {
      await onVeto(hasil.nilaiId, angka)
      setTersimpan(true)
      setTimeout(() => setTersimpan(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan nilai')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="px-4 desktop:px-5 pb-4 flex flex-col gap-3">
      {hasil?.nilaiId ? (
        <div className="rounded-md bg-isian border border-garis px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-teks-2 flex-1 min-w-40">
            Nilai otomatis dari {benar} benar / {soalList.length} soal{hasil.diubahGuru && ' · sudah diubah guru'}.
          </p>
          <label className="flex items-center gap-2 text-sm text-teks-2">
            Nilai
            <input type="number" inputMode="numeric" min={0} max={100} value={nilaiTeks}
              onChange={e => setNilaiTeks(e.target.value)}
              className="w-16 text-right py-1 bg-transparent text-teks outline-none border-b border-slate-400 focus:border-b-2 focus:border-indigo-600" />
          </label>
          <Button size="sm" onClick={() => void simpan()} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : tersimpan ? 'Tersimpan' : 'Simpan'}
          </Button>
          {error && <p className="basis-full text-xs text-salah">{error}</p>}
        </div>
      ) : (
        <p className="text-sm text-teks-2">Belum menekan Kirim — belum ada nilai untuk diubah.</p>
      )}

      {soalList.map((s, i) => {
        const dipilih = jawaban[s.id]
        return (
          <div key={s.id} className="rounded-md border border-garis px-4 py-3">
            <p className="text-sm text-teks whitespace-pre-wrap break-words"><span className="text-teks-2">{i + 1}. </span>{s.pertanyaan}</p>
            <div className="mt-2 flex flex-col">
              {s.pilihan.map((p, j) => {
                const kunci = j === s.jawabanBenar
                const pilihMurid = dipilih === j
                return (
                  <div key={j} className={`flex items-center gap-3 px-2 -mx-2 py-1.5 rounded ${
                    pilihMurid ? (kunci ? 'bg-green-50' : 'bg-red-50') : ''}`}>
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      pilihMurid ? (kunci ? 'border-benar' : 'border-salah') : 'border-slate-300'}`}>
                      {pilihMurid && <span className={`w-2 h-2 rounded-full ${kunci ? 'bg-benar' : 'bg-salah'}`} />}
                    </span>
                    <span className={`flex-1 min-w-0 text-sm break-words ${kunci ? 'text-benar' : 'text-teks'}`}>{p}</span>
                    {pilihMurid && !kunci && <Ikon nama="silang" className="w-4 h-4 text-salah" />}
                    {kunci && <Ikon nama="centang" className="w-4 h-4 text-benar" />}
                  </div>
                )
              })}
            </div>
            {dipilih === undefined && <p className="text-xs text-amber-700 mt-1">Tidak dijawab</p>}
          </div>
        )
      })}
    </div>
  )
}
