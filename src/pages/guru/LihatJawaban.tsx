import { useCallback, useEffect, useRef, useState } from 'react'
import type { HasilSoal, PesertaSesi, SesiKelas } from '../../types'
import { bacaHasilSoalSesi, ratakanSoalGuru, vetoNilaiSesi, type JawabanSoalMurid } from '../../lib/sesiGuru'
import { Gelembung, type StatusGelembung } from '../../components/Gelembung'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { useDesktop } from '../../lib/useDesktop'

// ─── Jawaban & nilai satu sesi ───────────────────────────────────────────────
// Takeover dari kendali sesi. Angka ringkas (rata-rata, tertinggi, terendah,
// berapa yang sudah mengirim) SELALU di atas; dua tampilan di bawahnya:
// Ringkasan (sebaran jawaban per soal) dan Murid (jawaban per orang + veto nilai).
//
// Benar/salah dihitung ULANG di klien dari kunci milik guru, MURNI untuk
// ditampilkan; nilai tersimpan tetap hasil selesaikan_murid() sampai guru
// menyimpan veto.
//
// Angka besar memakai huruf sans proporsional (bukan mono): mono hanya untuk
// jam dan kode. Meter selalu satu ramp -- lintasan tint, isi penuh.

const JEDA_MUAT_ULANG_MS = 10_000

// Desktop (≥ 1024px): tampilan Murid berubah dari daftar akordeon jadi
// MASTER-DETAIL -- tabel murid di kiri, jawaban & veto murid terpilih di kanan --
// karena layarnya cukup lebar untuk keduanya sekaligus. Strukturnya cukup beda
// sampai dipilih lewat `useDesktop`, bukan kelas `lg:`.
const KOLOM_TABEL = 'grid-cols-[minmax(0,1fr)_128px_84px]'

export function LihatJawaban({ sesi, onKembali }: { sesi: SesiKelas; onKembali: () => void }) {
  const [hasil, setHasil] = useState<JawabanSoalMurid[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const desktop = useDesktop()
  // Di desktop Murid-lah yang paling berguna (tabel + detail); di HP Ringkasan.
  const [tampilan, setTampilan] = useState<'ringkasan' | 'murid'>(desktop ? 'murid' : 'ringkasan')
  const [dipilih, setDipilih] = useState<string | null>(null)

  const soalList = ratakanSoalGuru(sesi.kontenList)
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

  async function veto(nilaiId: string, nilaiBaru: number) {
    await vetoNilaiSesi(nilaiId, nilaiBaru)
    setHasil(prev => prev?.map(m => (m.nilaiId === nilaiId ? { ...m, nilai: nilaiBaru, diubahGuru: true } : m)) ?? prev)
  }

  const hasilPer = new Map((hasil ?? []).map(h => [h.muridId, h]))
  const nilai = (hasil ?? []).map(h => h.nilai).filter((n): n is number => n != null)
  const rata = nilai.length ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null
  const jumlahMurid = sesi.muridJoined.length
  const persenKirim = jumlahMurid > 0 ? Math.min(100, (nilai.length / jumlahMurid) * 100) : 0

  // Murid terpilih di panel detail desktop: pilihan guru, kalau tidak yang
  // pertama sudah mengirim, kalau tidak yang pertama.
  const muridAktif = sesi.muridJoined.find(p => p.muridId === dipilih)
    ?? sesi.muridJoined.find(p => hasilPer.get(p.muridId)?.nilai != null)
    ?? sesi.muridJoined[0]

  const pilihan = (
    <div className="bg-garis rounded-[14px] p-1 flex gap-1 lg:w-75">
      {([['ringkasan', 'Ringkasan'], ['murid', `Murid (${jumlahMurid})`]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTampilan(id)} aria-pressed={tampilan === id}
          className={`flex-1 h-10.5 rounded-[11px] text-sm font-bold transition-colors ${
            tampilan === id ? 'bg-tinta text-white' : 'text-tinta-2 active:bg-garis-2'}`}>
          {label}
        </button>
      ))}
    </div>
  )

  const angka = ([['Rata-rata', rata], ['Tertinggi', nilai.length ? Math.max(...nilai) : null], ['Terendah', nilai.length ? Math.min(...nilai) : null]] as const)

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis lg:hidden">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <div className="min-w-0">
          <p className="text-base font-bold text-tinta truncate">Jawaban &amp; nilai</p>
          <p className="text-[12.5px] text-teks-3 truncate">{sesi.judul}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 desktop:max-w-2xl desktop:w-full desktop:mx-auto lg:max-w-6xl lg:px-12 lg:pt-10 lg:pb-12">
        <div className="flex flex-col gap-3 lg:gap-6">
          {/* Kepala desktop: jejak + judul + pilihan tampilan */}
          <div className="hidden lg:flex items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13.5px] text-teks-3">
                <button type="button" onClick={onKembali} className="font-semibold hover:text-tinta transition-colors">Sesi</button>
                <Ikon nama="kanan" className="w-3.5 h-3.5" tebal={2.2} />
                <button type="button" onClick={onKembali} className="font-semibold hover:text-tinta transition-colors truncate">{sesi.judul}</button>
                <Ikon nama="kanan" className="w-3.5 h-3.5" tebal={2.2} />
                <span>Jawaban &amp; nilai</span>
              </div>
              <h1 className="mt-2.5 text-[34px] leading-tight font-extrabold tracking-tight text-tinta">Jawaban &amp; nilai</h1>
            </div>
            {pilihan}
          </div>

          {/* Angka ringkas. HP: satu kartu; desktop: empat ubin sejajar. */}
          <div className="bg-white rounded-[18px] border border-garis p-4 lg:hidden">
            {nilai.length > 0 ? (
              <div className="grid grid-cols-3">
                {angka.map(([label, n], i) => (
                  <div key={label} className={i === 0 ? 'pr-2' : i === 1 ? 'px-2 border-l border-garis-2' : 'pl-3 border-l border-garis-2'}>
                    <p className="text-[12.5px] text-teks-3">{label}</p>
                    <p className="text-4xl font-extrabold tracking-tight leading-tight text-tinta mt-0.5">{n}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13.5px] text-teks-3">Belum ada murid yang mengirim jawaban.</p>
            )}
            <div className={`flex items-center gap-2.5 ${nilai.length > 0 ? 'mt-3.5' : 'mt-3'}`}>
              <div className="flex-1 h-2 rounded-full bg-biru-tint overflow-hidden">
                <div className="h-full rounded-full bg-biru" style={{ width: `${persenKirim}%` }} />
              </div>
              <p className="text-[12.5px] text-tinta-2 shrink-0">{nilai.length} dari {jumlahMurid} sudah mengirim</p>
            </div>
          </div>
          <div className="hidden lg:flex gap-4">
            {angka.map(([label, n]) => (
              <div key={label} className="flex-1 bg-white rounded-[18px] border border-garis px-5.5 py-4.5">
                <p className="text-[13px] text-teks-3">{label}</p>
                <p className="text-[44px] font-extrabold tracking-tight leading-tight text-tinta mt-0.5">{n ?? '–'}</p>
              </div>
            ))}
            <div className="flex-1 bg-white rounded-[18px] border border-garis px-5.5 py-4.5">
              <p className="text-[13px] text-teks-3">Sudah mengirim</p>
              <p className="text-[44px] font-extrabold tracking-tight leading-tight text-tinta mt-0.5">
                {nilai.length} <span className="text-xl font-semibold tracking-normal text-teks-3">dari {jumlahMurid}</span>
              </p>
              <div className="h-2 rounded-full bg-biru-tint overflow-hidden mt-2.5">
                <div className="h-full rounded-full bg-biru" style={{ width: `${persenKirim}%` }} />
              </div>
            </div>
          </div>

          <div className="lg:hidden">{pilihan}</div>

          {galat && (
            <div className="flex items-center gap-2 rounded-2xl border border-jingga-garis bg-jingga-tint px-4 py-3 text-sm text-jingga-gelap">
              <span className="flex-1">{galat}</span>
              <Button variant="ghost" size="sm" onClick={muat}>Coba lagi</Button>
            </div>
          )}

          {hasil === null ? (
            <div className="py-16 flex justify-center text-biru"><Spinner size={28} /></div>
          ) : tampilan === 'ringkasan' ? (
            <Ringkasan soalList={soalList} hasil={hasil} />
          ) : jumlahMurid === 0 ? (
            <div className="border-2 border-dashed border-pinggir-2 rounded-[18px] px-6 py-10 flex flex-col items-center gap-2 text-center">
              <Ikon nama="orang" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
              <p className="text-sm font-bold text-teks-3">Belum ada murid yang bergabung</p>
            </div>
          ) : desktop && muridAktif ? (
            <div className="grid grid-cols-[minmax(0,1fr)_500px] gap-6 items-start">
              <div className="bg-white rounded-[18px] border border-garis overflow-hidden">
                <div className={`grid ${KOLOM_TABEL} items-center gap-x-4 px-5.5 h-11.5`}>
                  {['Murid', 'Status', 'Nilai'].map((t, i) => (
                    <span key={t} className={`font-mono text-[11.5px] uppercase tracking-[0.14em] text-teks-3 ${i === 2 ? 'text-right' : ''}`}>{t}</span>
                  ))}
                </div>
                {sesi.muridJoined.map(p => (
                  <BarisTabelMurid key={p.muridId} peserta={p} hasil={hasilPer.get(p.muridId)} aktif={aktif}
                    terpilih={p.muridId === muridAktif.muridId} onPilih={() => setDipilih(p.muridId)} />
                ))}
              </div>
              <PanelMurid key={muridAktif.muridId} peserta={muridAktif} hasil={hasilPer.get(muridAktif.muridId)}
                soalList={soalList} aktif={aktif} onVeto={veto} />
            </div>
          ) : (
            <div className="bg-white rounded-[18px] border border-garis divide-y divide-garis-2 overflow-hidden">
              {sesi.muridJoined.map(p => (
                <BarisMurid key={p.muridId} peserta={p} hasil={hasilPer.get(p.muridId)}
                  soalList={soalList} aktif={aktif} onVeto={veto} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LabelNomor({ n }: { n: number }) {
  return (
    <span className="shrink-0 mt-0.5 rounded-md bg-tinta px-1.75 py-px font-mono text-xs font-medium text-white">
      {String(n).padStart(2, '0')}
    </span>
  )
}

// ─── Ringkasan per soal ──────────────────────────────────────────────────────

function Ringkasan({ soalList, hasil }: { soalList: HasilSoal[]; hasil: JawabanSoalMurid[] }) {
  return (
    <div className="flex flex-col gap-3">
      {soalList.map((s, i) => {
        // Hanya murid yang MENJAWAB soal ini -- yang kosong bukan "salah" di sini.
        const pilihanMurid = hasil.map(h => h.jawaban[s.id]).filter((j): j is number => j !== undefined)
        const benar = pilihanMurid.filter(j => j === s.jawabanBenar).length
        return (
          <div key={s.id} className="bg-white rounded-[18px] border border-garis p-4">
            <div className="flex gap-3">
              <LabelNomor n={i + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-semibold leading-snug text-tinta whitespace-pre-wrap break-words">{s.pertanyaan}</p>
                <p className="text-[13px] text-teks-3 mt-1">
                  {pilihanMurid.length === 0 ? 'Belum ada yang menjawab' : `${benar} dari ${pilihanMurid.length} jawaban benar`}
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              {s.pilihan.map((p, j) => {
                const jumlah = pilihanMurid.filter(x => x === j).length
                const persen = pilihanMurid.length ? Math.round((jumlah / pilihanMurid.length) * 100) : 0
                const kunci = j === s.jawabanBenar
                return (
                  <div key={j}>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Gelembung indeks={j} status={kunci ? 'benar' : 'kosong'} />
                      <span className={`flex-1 min-w-0 break-words text-sm text-tinta ${kunci ? 'font-bold' : ''}`}>{p}</span>
                      <span className="text-[13px] text-tinta-2 tabular-nums shrink-0">{jumlah} ({persen}%)</span>
                    </div>
                    <div className={`mt-1.5 ml-8.5 h-1.75 rounded-full overflow-hidden ${kunci ? 'bg-hijau-tint' : 'bg-biru-tint'}`}>
                      <div className={`h-full rounded-full ${kunci ? 'bg-hijau' : 'bg-biru'}`}
                        style={{ width: `${persen}%` }} />
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

// ─── Desktop: tabel murid + panel detail ─────────────────────────────────────

/** Kata status + sinyal pengawasan satu murid, dipakai tabel dan panel. */
function ringkasStatus(peserta: PesertaSesi, hasil: JawabanSoalMurid | undefined, aktif: boolean) {
  const sudahKirim = hasil?.nilai != null
  const teks = sudahKirim
    ? (hasil!.diubahGuru ? 'Nilai diubah guru' : 'Sudah mengirim')
    : aktif ? 'Belum mengirim' : 'Tidak mengirim'
  const sinyal = [
    peserta.keluarLayar > 0 && `${peserta.keluarLayar}× keluar layar`,
    peserta.hilangFokus > 0 && `${peserta.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')
  return { sudahKirim, teks, sinyal }
}

function BarisTabelMurid({ peserta, hasil, aktif, terpilih, onPilih }: {
  peserta: PesertaSesi
  hasil: JawabanSoalMurid | undefined
  aktif: boolean
  terpilih: boolean
  onPilih: () => void
}) {
  const { sudahKirim, teks, sinyal } = ringkasStatus(peserta, hasil, aktif)
  return (
    <button type="button" onClick={onPilih} aria-pressed={terpilih}
      className={`grid ${KOLOM_TABEL} w-full items-center gap-x-4 px-5.5 min-h-15.5 text-left border-t border-garis-2 transition-colors ${
        terpilih ? 'bg-biru-tipis ring-2 ring-inset ring-biru' : 'hover:bg-isian'}`}>
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0 text-[15px] font-extrabold">
          {peserta.nama.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-tinta truncate">{peserta.nama}</span>
          {sinyal && <span className="block text-[12.5px] font-bold text-jingga-gelap truncate">{sinyal}</span>}
        </span>
      </span>
      <span className="text-sm text-tinta-2">{teks}</span>
      <span className="text-[22px] font-extrabold tracking-tight text-right text-tinta">
        {sudahKirim
          ? <>{hasil!.nilai}{hasil!.diubahGuru && <span className="text-jingga-gelap">*</span>}</>
          : <span className="text-[13px] font-semibold tracking-normal text-teks-3">Belum ada</span>}
      </span>
    </button>
  )
}

function PanelMurid({ peserta, hasil, soalList, aktif, onVeto }: {
  peserta: PesertaSesi
  hasil: JawabanSoalMurid | undefined
  soalList: HasilSoal[]
  aktif: boolean
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
}) {
  const { sudahKirim, teks, sinyal } = ringkasStatus(peserta, hasil, aktif)
  return (
    <div className="bg-white rounded-[18px] border border-garis">
      <div className="flex items-center gap-3.5 px-5.5 pt-5.5">
        <div className="w-13 h-13 rounded-[14px] bg-biru-tint text-biru flex items-center justify-center text-xl font-extrabold shrink-0">
          {peserta.nama.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-extrabold tracking-tight text-tinta truncate">{peserta.nama}</p>
          <p className="text-[13px] text-teks-3">
            {teks}{sinyal && <span className="text-jingga-gelap font-bold"> · {sinyal}</span>}
          </p>
        </div>
        {sudahKirim
          ? <p className="text-[46px] font-extrabold tracking-tight leading-none text-tinta">{hasil!.nilai}</p>
          : <Badge warna="slate">Belum ada nilai</Badge>}
      </div>
      <JawabanMurid hasil={hasil} soalList={soalList} onVeto={onVeto} kelas="px-5.5 pt-4 pb-5.5" />
    </div>
  )
}

// ─── Satu murid ──────────────────────────────────────────────────────────────

function BarisMurid({ peserta, hasil, soalList, aktif, onVeto }: {
  peserta: PesertaSesi
  hasil: JawabanSoalMurid | undefined
  soalList: HasilSoal[]
  aktif: boolean
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
}) {
  const [buka, setBuka] = useState(false)
  const sudahKirim = hasil?.nilai != null

  const sinyal = [
    peserta.keluarLayar > 0 && `${peserta.keluarLayar}× keluar layar`,
    peserta.hilangFokus > 0 && `${peserta.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={buka ? 'bg-isian' : ''}>
      <div className={`flex items-center gap-3 px-4 py-3 ${buka ? 'bg-white' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0 text-[15px] font-extrabold">
          {peserta.nama.charAt(0).toUpperCase()}
        </div>
        <button type="button" onClick={() => setBuka(v => !v)} aria-expanded={buka} className="flex-1 min-w-0 text-left">
          <p className="text-[15px] font-bold text-tinta truncate">{peserta.nama}</p>
          <p className="text-[13px] text-teks-3">
            {sudahKirim
              ? (hasil!.diubahGuru ? 'Nilai diubah guru' : 'Sudah mengirim')
              : aktif ? 'Belum mengirim' : 'Tidak mengirim'}
            {sinyal && <span className="text-jingga-gelap font-bold"> · {sinyal}</span>}
          </p>
        </button>
        {sudahKirim && (
          <span className="shrink-0 text-xl font-extrabold tracking-tight tabular-nums text-tinta">
            {hasil!.nilai}{hasil!.diubahGuru && <span className="text-jingga-gelap" title="Diubah guru">*</span>}
          </span>
        )}
        <button type="button" onClick={() => setBuka(v => !v)} aria-label={buka ? 'Tutup jawaban' : 'Lihat jawaban'}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-teks-3 active:bg-garis-2 transition-all ${buka ? 'rotate-180' : ''}`}>
          <Ikon nama="bawah" className="w-4.5 h-4.5" tebal={2.2} />
        </button>
      </div>
      {buka && <JawabanMurid hasil={hasil} soalList={soalList} onVeto={onVeto} />}
    </div>
  )
}

function JawabanMurid({ hasil, soalList, onVeto, kelas = 'px-4 pt-3 pb-4' }: {
  hasil: JawabanSoalMurid | undefined
  soalList: HasilSoal[]
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
  /** Jarak dalam: akordeon HP rapat, panel desktop lebih lega. */
  kelas?: string
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
    <div className={`${kelas} flex flex-col gap-2.5`}>
      {hasil?.nilaiId ? (
        <div className="rounded-[14px] bg-white border border-garis px-3 py-3 flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-tinta-2 flex-1 min-w-40 leading-snug">
            Nilai otomatis dari {benar} benar dari {soalList.length} soal{hasil.diubahGuru && '. Sudah diubah guru'}.
          </p>
          <label htmlFor={`nilai-${hasil.nilaiId}`} className="text-[13px] text-tinta-2">Nilai</label>
          <input id={`nilai-${hasil.nilaiId}`} type="number" inputMode="numeric" min={0} max={100} value={nilaiTeks}
            onChange={e => setNilaiTeks(e.target.value)}
            className="w-20 h-10 px-2.5 text-right text-base font-bold text-tinta bg-white rounded-[10px] border-2 border-biru outline-none" />
          <Button size="sm" onClick={() => void simpan()} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : tersimpan ? 'Tersimpan' : 'Simpan'}
          </Button>
          {error && <p className="basis-full text-xs font-medium text-jingga-gelap">{error}</p>}
        </div>
      ) : (
        <p className="text-[13px] text-teks-3">Belum menekan Kirim, jadi belum ada nilai untuk diubah.</p>
      )}

      {soalList.map((s, i) => {
        const dipilih = jawaban[s.id]
        return (
          <div key={s.id} className="rounded-[14px] bg-white border border-garis p-3">
            <div className="flex gap-2.5 items-start">
              <LabelNomor n={i + 1} />
              <p className="flex-1 min-w-0 text-[13.5px] font-semibold leading-snug text-tinta whitespace-pre-wrap break-words">{s.pertanyaan}</p>
              {dipilih === undefined && <span className="text-xs font-bold text-jingga-gelap shrink-0">Tidak dijawab</span>}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {s.pilihan.map((p, j) => {
                const kunci = j === s.jawabanBenar
                const pilihMurid = dipilih === j
                // Status SELALU ditemani kata di kanan: warna saja tidak cukup.
                const status: StatusGelembung = pilihMurid ? (kunci ? 'benar' : 'salah') : kunci ? 'kunci' : 'kosong'
                const kata = pilihMurid ? (kunci ? 'Kunci · dijawab' : 'Dijawab salah') : kunci ? 'Kunci' : null
                return (
                  <div key={j} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] ${
                    pilihMurid ? (kunci ? 'bg-hijau-tint' : 'bg-jingga-tint') : ''}`}>
                    <Gelembung indeks={j} ukuran="sm" status={status} />
                    <span className={`flex-1 min-w-0 text-[13.5px] text-tinta break-words ${pilihMurid || kunci ? 'font-bold' : ''}`}>{p}</span>
                    {kata && (
                      <span className={`text-xs font-bold shrink-0 ${pilihMurid && !kunci ? 'text-jingga-gelap' : 'text-hijau-teks'}`}>
                        {kata}
                      </span>
                    )}
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
