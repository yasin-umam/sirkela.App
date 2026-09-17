import { useCallback, useEffect, useRef, useState } from 'react'
import { bacaHasilSoalSesi, vetoNilaiSesi } from '../../lib/sesiGuru'
import type { JawabanSoalMurid } from '../../lib/sesiGuru'
import type { HasilSoal, PesertaSesi } from '../../types'
import { hurufPilihan } from '../../lib/soal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'

// ─── Guru melihat & mem-veto jawaban + nilai murid (satu sesi) ────────────────
// Semua grup soal yang ditempel ke sesi digabung jadi satu kuis dan satu baris
// nilai_murid per murid -- makanya cuma ada SATU layar ini per sesi.
//
// Benar/salah di sini dihitung ULANG di klien dari kunci milik guru, MURNI untuk
// ditampilkan; nilai tersimpan tetap hasil selesaikan_murid() sampai guru
// menekan "Simpan Nilai" (veto).

function hitungBenar(soalList: HasilSoal[], jawaban: Record<string, number>): number {
  let benar = 0
  for (const s of soalList) if (jawaban[s.id] === s.jawabanBenar) benar++
  return benar
}

function KartuMurid({ m, soalList, onVeto }: {
  m: JawabanSoalMurid
  soalList: HasilSoal[]
  onVeto: (nilaiId: string, nilaiBaru: number) => Promise<void>
}) {
  const [buka, setBuka] = useState(false)
  const [nilaiTeks, setNilaiTeks] = useState(m.nilai != null ? String(m.nilai) : '')
  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terjawab = soalList.filter(s => m.jawaban[s.id] !== undefined).length
  const benar = hitungBenar(soalList, m.jawaban)

  async function simpan() {
    if (!m.nilaiId) return
    const t = nilaiTeks.trim()
    const angka = Number(t)
    // Kolom nilai bertipe int dengan CHECK 0-100 -- pecahan dan angka di luar
    // rentang ditolak di sini dengan pesan yang bisa dibaca, bukan error Postgres.
    if (t === '' || !Number.isInteger(angka) || angka < 0 || angka > 100) {
      setError('Nilai harus bilangan bulat 0–100')
      return
    }
    setMenyimpan(true)
    setError(null)
    try {
      await onVeto(m.nilaiId, angka)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan nilai')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-2.5">
      <button onClick={() => setBuka(v => !v)} className="flex items-center justify-between gap-3 text-left w-full">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 truncate">{m.nama}</p>
          <p className="text-[11px] text-slate-400">
            {m.nilai != null ? `${terjawab} dari ${soalList.length} dijawab · ${benar} benar` : 'Belum mengirim jawaban'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {m.diubahGuru && <Badge color="yellow">Diubah guru</Badge>}
          {m.nilai != null && <Badge color="green">{m.nilai}</Badge>}
          <span className="text-[11px] font-bold text-indigo-600">{buka ? 'Tutup' : 'Lihat'}</span>
        </div>
      </button>

      {buka && (
        <>
          <div className="flex flex-col gap-2.5">
            {soalList.map((s, i) => {
              const dijawab = m.jawaban[s.id]
              return (
                <div key={s.id} className="rounded-xl border border-slate-100 p-2.5 flex flex-col gap-1.5">
                  <p className="text-xs text-slate-700 leading-snug whitespace-pre-wrap">
                    <span className="font-bold text-slate-400">{i + 1}. </span>{s.pertanyaan}
                  </p>
                  <div className="flex flex-col gap-1">
                    {s.pilihan.map((p, j) => {
                      const adalahKunci = j === s.jawabanBenar
                      const dipilihMurid = dijawab === j
                      return (
                        <div key={j} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                          adalahKunci ? 'bg-emerald-50 border-emerald-300'
                            : dipilihMurid ? 'bg-red-50 border-red-300'
                            : 'bg-white border-slate-100'
                        }`}>
                          <span className={`w-4.5 h-4.5 rounded-full border-2 shrink-0 flex items-center justify-center text-[9px] font-bold ${
                            adalahKunci ? 'border-emerald-500 bg-emerald-500 text-white'
                              : dipilihMurid ? 'border-red-400 text-red-500'
                              : 'border-slate-200 text-slate-400'
                          }`}>{hurufPilihan(j)}</span>
                          <span className="flex-1 text-slate-700">{p}</span>
                          {adalahKunci && <span className="text-[9px] font-bold text-emerald-600 shrink-0">Kunci</span>}
                          {dipilihMurid && !adalahKunci && <span className="text-[9px] font-bold text-red-500 shrink-0">Dipilih murid</span>}
                        </div>
                      )
                    })}
                  </div>
                  {dijawab === undefined && <p className="text-[10px] text-amber-600">Belum dijawab</p>}
                </div>
              )
            })}
          </div>

          {m.nilaiId ? (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-50">
              <p className="text-[11px] text-slate-400">
                Nilai otomatis dari {benar} benar / {soalList.length} soal. Ubah di sini untuk veto.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={nilaiTeks}
                  onChange={e => setNilaiTeks(e.target.value)}
                  placeholder="Nilai"
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                />
                <Button size="sm" onClick={() => void simpan()} disabled={menyimpan}>
                  {menyimpan ? 'Menyimpan…' : 'Simpan Nilai'}
                </Button>
              </div>
              {error && <p className="text-[11px] text-red-600">{error}</p>}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-50">
              Murid belum menekan "Kirim Jawaban" — belum ada nilai untuk diveto.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export function LihatJawabanSoal({ sesiId, judul, soalList, peserta, onKembali }: {
  sesiId: string
  judul: string
  soalList: HasilSoal[]
  peserta: PesertaSesi[]
  onKembali: () => void
}) {
  const [list, setList] = useState<JawabanSoalMurid[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  // Peserta dibaca lewat ref saat dimuat, BUKAN dependensi: Realtime memperbarui
  // daftar peserta tiap denyut (20 detik), dan memuat ulang di tiap denyut akan
  // menutup kartu yang sedang dibuka guru. "Muat ulang" tetap memakai daftar
  // terbaru, termasuk murid yang baru bergabung.
  const pesertaRef = useRef(peserta)
  pesertaRef.current = peserta
  const muat = useCallback(() => {
    setGalat(null)
    bacaHasilSoalSesi(sesiId, pesertaRef.current)
      .then(setList)
      .catch(e => { setList([]); setGalat(e instanceof Error ? e.message : 'Gagal memuat jawaban') })
  }, [sesiId])
  useEffect(() => { muat() }, [muat])

  async function veto(nilaiId: string, nilaiBaru: number) {
    await vetoNilaiSesi(nilaiId, nilaiBaru)
    setList(prev => prev?.map(m => (m.nilaiId === nilaiId ? { ...m, nilai: nilaiBaru, diubahGuru: true } : m)) ?? prev)
  }

  // Yang sudah mengirim dulu -- guru paling sering mencari yang perlu ditinjau.
  const terurut = list ? [...list].sort((a, b) => (b.nilai ?? -1) - (a.nilai ?? -1)) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onKembali} aria-label="Kembali" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-800 truncate">{judul}</h3>
          <p className="text-xs text-slate-400">
            {soalList.length} soal · {terurut ? `${terurut.filter(m => m.nilai != null).length} sudah mengirim` : 'Memuat…'}
          </p>
        </div>
        <button onClick={muat} className="text-[11px] font-bold text-indigo-600 px-2.5 py-1.5 rounded-lg active:bg-indigo-50 shrink-0">
          Muat ulang
        </button>
      </div>

      {galat && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{galat}</div>}

      {terurut === null ? (
        <div className="h-40 flex items-center justify-center"><Spinner /></div>
      ) : terurut.length === 0 && !galat ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-6 text-center">
          <p className="text-xs text-slate-400">Belum ada murid yang bergabung</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {terurut.map(m => (
            <KartuMurid key={m.muridId} m={m} soalList={soalList} onVeto={veto} />
          ))}
        </div>
      )}
    </div>
  )
}
