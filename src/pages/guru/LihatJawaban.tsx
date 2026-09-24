import { useCallback, useEffect, useRef, useState } from 'react'
import type { HasilSoal, PesertaSesi, SesiKelas } from '../../types'
import { bacaHasilSoalSesi, ratakanSoalGuru, vetoNilaiSesi, type JawabanSoalMurid } from '../../lib/sesiGuru'
import { HURUF_OPSI } from '../../components/LayarMurid'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'

// ─── Jawaban & nilai satu sesi ───────────────────────────────────────────────
// Takeover dari kendali sesi, sama seperti LihatJawabanSoal di Luang. Dua
// tampilan: Ringkasan (sebaran jawaban per soal) dan Murid (jawaban per orang +
// veto nilai).
//
// Benar/salah dihitung ULANG di klien dari kunci milik guru, MURNI untuk
// ditampilkan; nilai tersimpan tetap hasil selesaikan_murid() sampai guru
// menyimpan veto.

const JEDA_MUAT_ULANG_MS = 10_000

export function LihatJawaban({ sesi, onKembali }: { sesi: SesiKelas; onKembali: () => void }) {
  const [hasil, setHasil] = useState<JawabanSoalMurid[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [tampilan, setTampilan] = useState<'ringkasan' | 'murid'>('ringkasan')

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
  const mengirim = (hasil ?? []).filter(h => h.nilai != null)

  return (
    <div className="flex flex-col h-full bg-slate-50 tekstur-latar">
      <div className="px-2 py-1 flex items-center gap-2 shrink-0 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
          <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">Jawaban &amp; nilai</p>
          <p className="text-[11px] text-slate-400 truncate">{sesi.judul}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-linear-to-br from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-200 px-5 py-4">
            <p className="text-3xl font-bold leading-tight">{mengirim.length} jawaban</p>
            <p className="text-sm text-indigo-100 mt-1">
              {sesi.muridJoined.length} murid bergabung · {soalList.length} soal
            </p>
          </div>

          <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
            {([['ringkasan', 'Ringkasan'], ['murid', `Murid (${sesi.muridJoined.length})`]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTampilan(id)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tampilan === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {galat && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="flex-1">{galat}</span>
              <Button variant="ghost" size="sm" onClick={muat}>Coba lagi</Button>
            </div>
          )}

          {hasil === null ? (
            <div className="py-16 flex justify-center text-indigo-500"><Spinner size={28} /></div>
          ) : tampilan === 'ringkasan' ? (
            <Ringkasan soalList={soalList} hasil={hasil} />
          ) : sesi.muridJoined.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl px-6 py-10 flex flex-col items-center gap-2 text-center">
              <Ikon nama="orang" className="w-8 h-8 text-slate-300" tebal={1.5} />
              <p className="text-sm font-semibold text-slate-500">Belum ada murid yang bergabung</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
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

// ─── Ringkasan per soal ──────────────────────────────────────────────────────

function Ringkasan({ soalList, hasil }: { soalList: HasilSoal[]; hasil: JawabanSoalMurid[] }) {
  const nilai = hasil.map(h => h.nilai).filter((n): n is number => n != null)
  const rata = nilai.length ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700">Nilai</h3>
        {nilai.length === 0 ? (
          <p className="text-xs text-slate-400 mt-1.5">Belum ada murid yang mengirim jawaban.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {([['Rata-rata', rata], ['Tertinggi', Math.max(...nilai)], ['Terendah', Math.min(...nilai)]] as const).map(([label, n]) => (
              <div key={label} className="rounded-xl bg-slate-50 py-3">
                <p className="text-xl font-bold text-slate-800 tabular-nums">{n}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
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
          <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex gap-2.5">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap break-words">{s.pertanyaan}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {pilihanMurid.length === 0 ? 'Belum ada yang menjawab' : `${benar} dari ${pilihanMurid.length} jawaban benar`}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {s.pilihan.map((p, j) => {
                const jumlah = pilihanMurid.filter(x => x === j).length
                const persen = pilihanMurid.length ? Math.round((jumlah / pilihanMurid.length) * 100) : 0
                const kunci = j === s.jawabanBenar
                return (
                  <div key={j}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        kunci ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {HURUF_OPSI[j] ?? j + 1}
                      </span>
                      <span className={`flex-1 min-w-0 break-words text-sm ${
                        kunci ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>{p}</span>
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">{jumlah} ({persen}%)</span>
                    </div>
                    <div className="mt-1 ml-7 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${kunci ? 'bg-emerald-500' : 'bg-indigo-400'}`}
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
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-sm font-bold">
          {peserta.nama.charAt(0).toUpperCase()}
        </div>
        <button type="button" onClick={() => setBuka(v => !v)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-slate-700 truncate">{peserta.nama}</p>
          <p className="text-[11px] text-slate-400">
            {sudahKirim
              ? <span className="text-emerald-600 font-medium">Sudah mengirim</span>
              : aktif ? 'Belum mengirim' : 'Tidak mengirim'}
            {sinyal && <span className="text-amber-700"> · {sinyal}</span>}
          </p>
        </button>
        {sudahKirim && (
          <span className={`shrink-0 text-sm font-bold tabular-nums ${hasil!.diubahGuru ? 'text-amber-700' : 'text-slate-800'}`}
            title={hasil!.diubahGuru ? 'Diubah guru' : undefined}>
            {hasil!.nilai}{hasil!.diubahGuru && '*'}
          </span>
        )}
        <TombolIkon nama="bawah" label={buka ? 'Tutup jawaban' : 'Lihat jawaban'} onClick={() => setBuka(v => !v)}
          className={`w-9 h-9 ${buka ? 'rotate-180' : ''}`} ukuran="w-4 h-4" />
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
    <div className="px-4 pb-4 flex flex-col gap-2.5">
      {hasil?.nilaiId ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-slate-500 flex-1 min-w-40">
            Nilai otomatis dari {benar} benar / {soalList.length} soal{hasil.diubahGuru && ' · sudah diubah guru'}.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Nilai
            <input type="number" inputMode="numeric" min={0} max={100} value={nilaiTeks}
              onChange={e => setNilaiTeks(e.target.value)}
              className="w-16 px-2 py-1.5 text-right text-sm text-slate-800 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-400" />
          </label>
          <Button size="sm" onClick={() => void simpan()} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : tersimpan ? 'Tersimpan' : 'Simpan'}
          </Button>
          {error && <p className="basis-full text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Belum menekan Kirim, jadi belum ada nilai untuk diubah.</p>
      )}

      {soalList.map((s, i) => {
        const dipilih = jawaban[s.id]
        return (
          <div key={s.id} className="rounded-xl border border-slate-100 px-3 py-3">
            <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap break-words">
              <span className="text-slate-400">{i + 1}. </span>{s.pertanyaan}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {s.pilihan.map((p, j) => {
                const kunci = j === s.jawabanBenar
                const pilihMurid = dipilih === j
                return (
                  <div key={j} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                    pilihMurid ? (kunci ? 'bg-emerald-50' : 'bg-red-50') : ''}`}>
                    <span className={`w-4.5 h-4.5 rounded-full border-2 shrink-0 flex items-center justify-center text-[9px] font-bold ${
                      kunci ? 'bg-emerald-500 border-emerald-500 text-white'
                        : pilihMurid ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      {HURUF_OPSI[j] ?? j + 1}
                    </span>
                    <span className={`flex-1 min-w-0 text-xs break-words ${kunci ? 'text-emerald-700' : 'text-slate-600'}`}>{p}</span>
                    {pilihMurid && (
                      <span className={`text-[10px] font-bold shrink-0 ${kunci ? 'text-emerald-600' : 'text-red-600'}`}>
                        dijawab
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {dipilih === undefined && <p className="text-[11px] text-amber-700 mt-1">Tidak dijawab</p>}
          </div>
        )
      })}
    </div>
  )
}
