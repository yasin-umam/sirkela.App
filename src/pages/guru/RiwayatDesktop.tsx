import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormulir, type RingkasFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { useAksiGuru } from '../../context/AksiGuruContext'
import { sesiBisaDihapus, statusSesi } from '../../lib/keadaanSesi'
import { jamMenit, kelasJurusan, labelWaktu, tanggalLengkap, waktuRingkas } from '../../lib/soal'
import { supabase } from '../../lib/supabase'
import { soalUji } from '../../lib/ujiTampilan'
import { useKirimanSuper } from '../../lib/useKirimanSuper'
import { BilahAtas } from '../../components/BilahAtas'
import { BarisTabel, KepalaTabel } from '../../components/TabelDesktop'
import { Badge } from '../../components/ui/Badge'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { KonfirmasiHapus } from '../../components/KonfirmasiHapus'

// ─── Riwayat desktop (≥ 1024px): tabel + panel detail ────────────────────────
// Master-detail: tabel di kiri memilih, panel di kanan menjelaskan satu formulir
// (soal pertama, sesi yang pernah lahir darinya) dan menawarkan Edit/Kirim. Satu
// ketukan MEMILIH baris, bukan membuka editor -- guru yang cuma mencari "formulir
// mana tadi" tidak perlu keluar-masuk editor. Ketuk dua kali = buka editor.
// Pencarian dan penyaring kelas/mapel murni di klien terhadap daftar yang sudah
// dimuat. HP tetap memakai RiwayatPage.

type Pil = 'formulir' | 'sesi'

// Hapus riwayat (H1/H2): formulir kapan pun; sesi lewat sesiBisaDihapus() (lib/keadaanSesi).
type TargetHapus =
  | { jenis: 'formulir'; id: string; judul: string; jumlahSoal: number }
  | { jenis: 'sesi'; id: string; judul: string; kode: string; jumlahMurid: number }

const KOLOM_FORMULIR = 'grid-cols-[minmax(0,1fr)_88px_56px_112px_96px]'
const KOLOM_SESI = 'grid-cols-[minmax(0,1fr)_120px_100px_190px_150px_24px]'

function Penyaring({ label, nilai, onUbah, semua, pilihan }: {
  label: string
  nilai: string
  onUbah: (v: string) => void
  semua: string
  pilihan: string[]
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select value={nilai} onChange={e => onUbah(e.target.value)}
        className="h-10.5 appearance-none rounded-xl border-[1.5px] border-pinggir-2 bg-white pl-3.5 pr-9 text-sm font-semibold text-tinta outline-none focus:border-biru cursor-pointer max-w-56">
        <option value="">{semua}</option>
        {pilihan.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <Ikon nama="bawah" className="w-3.75 h-3.75 text-teks-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" tebal={2.4} />
    </label>
  )
}

export function RiwayatDesktop({ onBukaFormulir, onBukaSesi }: {
  onBukaFormulir: (formulirId: string) => void
  onBukaSesi: (sesiId: string) => void
}) {
  const { daftar, memuat, hapusFormulir } = useFormulir()
  const { semuaSesi, hapusSesi } = useSesi()
  const kirimanSuper = useKirimanSuper()
  const [hapus, setHapus] = useState<TargetHapus | null>(null)
  const [pil, setPil] = useState<Pil>('formulir')
  const [q, setQ] = useState('')
  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [dipilihId, setDipilihId] = useState<string | null>(null)

  const berjalan = new Set(semuaSesi.filter(s => s.status === 'aktif').map(s => s.formulirId).filter((id): id is string => !!id))
  const opsiKelas = useMemo(() => [...new Set(daftar.map(f => f.kelas.trim()).filter(Boolean))].sort(), [daftar])
  const opsiMapel = useMemo(() => [...new Set(daftar.map(f => f.mapel.trim()).filter(Boolean))].sort(), [daftar])

  const kata = q.trim().toLowerCase()
  const formulirTampil = daftar.filter(f =>
    (!kata || f.judul.toLowerCase().includes(kata) || f.mapel.toLowerCase().includes(kata) || f.jurusan.toLowerCase().includes(kata))
    && (!kelas || f.kelas.trim() === kelas) && (!mapel || f.mapel.trim() === mapel))
  const sesiTampil = semuaSesi.filter(s => !kata || s.judul.toLowerCase().includes(kata) || s.kodeJoin.toLowerCase().includes(kata))
  const dipilih = formulirTampil.find(f => f.id === dipilihId) ?? formulirTampil[0] ?? null
  const adaSaringan = !!(kata || kelas || mapel)

  return (
    <div className="flex flex-col h-full bg-alas">
      <BilahAtas judul="Riwayat" />
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar">
        <div className="px-8 pt-7 pb-10 max-w-350 mx-auto flex flex-col gap-5">

          <div className="flex items-center gap-3">
            <div role="group" aria-label="Jenis arsip" className="bg-garis rounded-[14px] p-1 flex gap-1 w-65">
              {([['formulir', 'Formulir', daftar.length], ['sesi', 'Sesi', semuaSesi.length]] as const).map(([id, label, jumlah]) => (
                <button key={id} type="button" onClick={() => setPil(id)} aria-pressed={pil === id}
                  className={`flex-1 h-9.5 rounded-[11px] text-sm font-bold transition-colors ${
                    pil === id ? 'bg-tinta text-white' : 'text-tinta-2 hover:bg-garis-2'}`}>
                  {label}<span className={`ml-1.5 font-medium ${pil === id ? 'text-biru-muda' : 'text-teks-3'}`}>{jumlah}</span>
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <label className="relative block w-75">
              <span className="sr-only">{pil === 'formulir' ? 'Cari formulir' : 'Cari sesi'}</span>
              <Ikon nama="cari" className="w-4.5 h-4.5 text-teks-3 absolute left-3.5 top-1/2 -translate-y-1/2" tebal={2} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder={pil === 'formulir' ? 'Cari judul formulir' : 'Cari judul atau kode sesi'}
                className="w-full h-10.5 rounded-xl border-[1.5px] border-pinggir-2 bg-white pl-10.5 pr-3.5 text-sm text-tinta placeholder:text-teks-3 outline-none focus:border-biru" />
            </label>
            {pil === 'formulir' && (
              <>
                <Penyaring label="Saring kelas" nilai={kelas} onUbah={setKelas} semua="Semua kelas" pilihan={opsiKelas} />
                <Penyaring label="Saring mapel" nilai={mapel} onUbah={setMapel} semua="Semua mapel" pilihan={opsiMapel} />
              </>
            )}
          </div>

          {pil === 'formulir' ? (
            memuat && daftar.length === 0 ? (
              <div className="py-16 flex justify-center text-biru"><Spinner size={26} /></div>
            ) : daftar.length === 0 ? (
              <Kosong ikon="soal" judul="Belum ada formulir" pesan="Formulir yang kamu tulis atau impor muncul di sini." />
            ) : formulirTampil.length === 0 ? (
              <Kosong ikon="cari" judul="Tidak ada formulir yang cocok" pesan="Ubah kata kunci atau lepas penyaring kelas dan mapel." />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                <section aria-label="Daftar formulir" className="bg-white rounded-[18px] border border-garis overflow-hidden min-w-0">
                  <div className={`grid ${KOLOM_FORMULIR} gap-x-3 px-5 h-10 items-center bg-isian font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3`}>
                    <span>Judul</span><span>Kelas</span><span>Soal</span><span>Diperbarui</span><span>Status</span>
                  </div>
                  {formulirTampil.map(f => {
                    const terpilih = dipilih?.id === f.id
                    return (
                      <button key={f.id} type="button" aria-pressed={terpilih}
                        onClick={() => setDipilihId(f.id)} onDoubleClick={() => onBukaFormulir(f.id)}
                        className={`grid ${KOLOM_FORMULIR} gap-x-3 w-full px-5 min-h-15 items-center text-left border-t border-garis-2 transition-colors ${
                          terpilih ? 'bg-biru-tipis ring-[1.5px] ring-inset ring-biru' : 'hover:bg-isian'}`}>
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-[11px] bg-biru-tint text-biru flex items-center justify-center shrink-0">
                            <Ikon nama="dokumen" className="w-4.75 h-4.75" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-tinta truncate">{f.judul.trim() || 'Formulir tanpa judul'}</span>
                            <span className="block text-[12.5px] text-teks-3 truncate">{f.mapel.trim() || 'Belum diisi'}</span>
                          </span>
                        </span>
                        <span className="text-[13.5px] text-tinta-2 truncate">{kelasJurusan(f.kelas, f.jurusan) || '–'}</span>
                        <span className="text-[13.5px] text-tinta-2">{f.jumlahSoal}</span>
                        <span className="text-[13px] text-teks-3">{waktuRingkas(f.diperbaruiPada)}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {berjalan.has(f.id) && <Badge warna="hijau" titik>Berjalan</Badge>}
                          {kirimanSuper.has(f.id) && <Badge warna="biru">Super Sesi</Badge>}
                          {!berjalan.has(f.id) && !kirimanSuper.has(f.id) && f.jumlahSoal === 0 && <Badge warna="slate">Draf</Badge>}
                        </span>
                      </button>
                    )
                  })}
                  <p className="px-5 py-3.5 border-t border-garis-2 text-[13px] text-teks-3">
                    {adaSaringan ? `${formulirTampil.length} dari ${daftar.length} formulir` : `${daftar.length} formulir`} · ketuk dua kali untuk membuka editor
                  </p>
                </section>
                {dipilih && (
                  <DetailFormulir key={dipilih.id} f={dipilih} onBukaFormulir={onBukaFormulir} onBukaSesi={onBukaSesi}
                    onHapus={() => setHapus({ jenis: 'formulir', id: dipilih.id, judul: dipilih.judul.trim() || 'Formulir tanpa judul', jumlahSoal: dipilih.jumlahSoal })} />
                )}
              </div>
            )
          ) : semuaSesi.length === 0 ? (
            <Kosong ikon="sesi" judul="Belum ada sesi" pesan="Buka formulirmu lalu tekan Kirim. Sesi lahir dengan kodenya sendiri." />
          ) : sesiTampil.length === 0 ? (
            <Kosong ikon="cari" judul="Tidak ada sesi yang cocok" pesan="Ubah kata kunci pencarian." />
          ) : (
            <section aria-label="Daftar sesi" className="bg-white rounded-[18px] border border-garis overflow-hidden">
              <KepalaTabel kolom={KOLOM_SESI} judul={['Judul', 'Kode', 'Murid', 'Dibuat', 'Status', '']} />
              {sesiTampil.map(s => {
                const st = statusSesi(s)
                const bisaHapus = sesiBisaDihapus(s)
                return (
                  <BarisTabel key={s.id} kolom={KOLOM_SESI} onClick={() => onBukaSesi(s.id)}
                    aksi={bisaHapus ? (
                      <TombolIkon nama="hapus" label={`Hapus sesi ${s.judul}`} ukuran="w-4.5 h-4.5"
                        className="hover:bg-jingga-tint hover:text-jingga-gelap"
                        onClick={() => setHapus({ jenis: 'sesi', id: s.id, judul: s.judul, kode: s.kodeJoin, jumlahMurid: s.muridJoined.length })} />
                    ) : undefined}>
                    <span className="flex items-center gap-3.5 min-w-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        s.status === 'aktif' ? 'bg-hijau-tint text-hijau' : 'bg-garis-2 text-teks-3'}`}>
                        <Ikon nama="sesi" className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold text-tinta truncate">{s.judul}</span>
                        {/* Sesi yatim tidak bisa lagi dibuka dari formulirnya --
                            baris ini satu-satunya jalan ke nilainya, jadi
                            keadaannya dikatakan. */}
                        {!s.formulirId && <span className="block text-[13px] text-teks-3">formulir dihapus</span>}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-medium text-tinta">{s.kodeJoin}</span>
                    <span className="text-sm text-tinta-2">{s.muridJoined.length} murid</span>
                    <span className="text-sm text-teks-3">{labelWaktu(s.dibuatPada)} {jamMenit(s.dibuatPada)}</span>
                    <span><Badge warna={st.warna} titik={st.label === 'Berjalan'}>{st.label}</Badge></span>
                    {/* Baris yang bisa dihapus: tombol hapus melayang di kolom ini. */}
                    {bisaHapus ? <span /> : <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />}
                  </BarisTabel>
                )
              })}
            </section>
          )}
        </div>
      </div>

      {hapus && (
        <KonfirmasiHapus
          judul={hapus.jenis === 'formulir' ? 'Hapus formulir ini?' : 'Hapus sesi ini?'}
          pesan={hapus.jenis === 'formulir' ? (
            <>
              “{hapus.judul}” dan {hapus.jumlahSoal} pertanyaannya dihapus. Sesi yang sudah lahir dari formulir ini tetap ada.
              <strong className="block mt-3 text-tinta">Tidak bisa dibatalkan.</strong>
            </>
          ) : (
            <>
              “{hapus.judul}” (kode {hapus.kode}) dihapus bersama {hapus.jumlahMurid} murid yang bergabung, jawaban, dan nilainya.
              <strong className="block mt-3 text-tinta">Tidak bisa dibatalkan.</strong>
            </>
          )}
          onHapus={() => hapus.jenis === 'formulir' ? hapusFormulir(hapus.id) : hapusSesi(hapus.id)}
          onTutup={() => setHapus(null)} />
      )}
    </div>
  )
}

// ─── Panel detail satu formulir ──────────────────────────────────────────────

function Meta({ label, nilai }: { label: string; nilai: ReactNode }) {
  return (
    <div>
      <p className="text-[12.5px] text-teks-3">{label}</p>
      <p className="text-[15px] font-bold text-tinta mt-0.5">{nilai}</p>
    </div>
  )
}

function DetailFormulir({ f, onBukaFormulir, onBukaSesi, onHapus }: {
  f: RingkasFormulir
  onBukaFormulir: (id: string) => void
  onBukaSesi: (id: string) => void
  onHapus: () => void
}) {
  const { semuaSesi } = useSesi()
  const { mulaiSesiBaru } = useAksiGuru()
  const [soalAwal, setSoalAwal] = useState<string[] | null>(null)

  // Tiga pertanyaan pertama saja: cuma untuk mengenali formulirnya, bukan
  // pratinjau lengkap (itu tombol Pratinjau di editor).
  useEffect(() => {
    if (f.jumlahSoal === 0) { setSoalAwal([]); return }
    if (import.meta.env.VITE_UJI_TAMPILAN) { setSoalAwal(soalUji(f.id).slice(0, 3).map(s => s.pertanyaan)); return }
    let batal = false
    void supabase.from('bank_soal').select('pertanyaan').eq('formulir_id', f.id)
      .order('urutan').order('created_at').limit(3)
      .then(({ data }) => { if (!batal) setSoalAwal(((data ?? []) as { pertanyaan: string }[]).map(r => r.pertanyaan)) })
    return () => { batal = true }
  }, [f.id, f.jumlahSoal])

  const sesiLahir = semuaSesi.filter(s => s.formulirId === f.id)
  const info = [kelasJurusan(f.kelas, f.jurusan), f.mapel.trim()].filter(Boolean).join(' · ') || 'Kelas dan mapel belum diisi'

  return (
    <aside aria-label="Detail formulir terpilih" className="bg-white rounded-[18px] border border-garis p-5.5 flex flex-col gap-4.5 min-w-0">
      <div className="flex items-start gap-3.5">
        <span className="w-12 h-12 rounded-[14px] bg-biru-tint text-biru flex items-center justify-center shrink-0">
          <Ikon nama="dokumen" className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3">Formulir terpilih</p>
          <h2 className="mt-1 text-[19px] leading-tight font-extrabold tracking-tight text-tinta break-words">{f.judul.trim() || 'Formulir tanpa judul'}</h2>
          <p className="mt-0.75 text-[13.5px] text-teks-3">{info}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => onBukaFormulir(f.id)}
          className="flex-1 h-11 rounded-xl bg-biru text-white text-[14.5px] font-bold inline-flex items-center justify-center gap-2 hover:bg-biru-gelap transition-colors">
          <Ikon nama="pensil" className="w-4 h-4" tebal={2} />Edit formulir
        </button>
        <button type="button" onClick={() => mulaiSesiBaru(f.id)}
          className="h-11 px-4 rounded-xl border-[1.5px] border-pinggir-2 bg-white text-[14.5px] font-bold text-tinta inline-flex items-center gap-2 hover:bg-isian transition-colors">
          <Ikon nama="kirim" className="w-4 h-4" tebal={2} />Kirim
        </button>
        <button type="button" onClick={onHapus} aria-label="Hapus formulir" title="Hapus formulir"
          className="h-11 w-11 shrink-0 rounded-xl border-[1.5px] border-pinggir-2 bg-white text-teks-3 inline-flex items-center justify-center hover:bg-jingga-tint hover:border-jingga-garis hover:text-jingga-gelap transition-colors">
          <Ikon nama="hapus" className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 py-4 border-y border-garis-2">
        <Meta label="Pertanyaan" nilai={`${f.jumlahSoal} soal`} />
        <Meta label="Durasi" nilai={`${f.durasiMenit} menit`} />
        <Meta label="Dibuat" nilai={tanggalLengkap(f.dibuatPada)} />
        <Meta label="Diperbarui" nilai={waktuRingkas(f.diperbaruiPada)} />
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 mb-2.5">Pertanyaan</p>
        {soalAwal === null ? (
          <div className="py-3 flex justify-center text-biru"><Spinner size={20} /></div>
        ) : soalAwal.length === 0 ? (
          <p className="text-[13.5px] text-teks-3">Belum ada pertanyaan.</p>
        ) : (
          <>
            <ol className="flex flex-col gap-2.5">
              {soalAwal.map((p, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="shrink-0 mt-px rounded-[7px] bg-tinta px-1.75 py-px font-mono text-xs font-medium text-white">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[13.5px] leading-snug text-tinta-2 line-clamp-2">{p.trim() || 'Pertanyaan kosong'}</span>
                </li>
              ))}
            </ol>
            {f.jumlahSoal > soalAwal.length && (
              <button type="button" onClick={() => onBukaFormulir(f.id)}
                className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-bold text-biru hover:text-biru-gelap">
                Lihat {f.jumlahSoal - soalAwal.length} lainnya di editor<Ikon nama="kanan" className="w-3.75 h-3.75" tebal={2.4} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="pt-4 border-t border-garis-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 mb-2.5">Pernah dikirim · {sesiLahir.length}</p>
        {sesiLahir.length === 0 ? (
          <p className="text-[13.5px] text-teks-3">Belum pernah dikirim sebagai sesi.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sesiLahir.map(s => {
              const st = statusSesi(s)
              return (
                <button key={s.id} type="button" onClick={() => onBukaSesi(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-garis-2 bg-isian text-left hover:border-pinggir-2 transition-colors">
                  <span className={`w-8.5 h-8.5 rounded-[10px] flex items-center justify-center shrink-0 ${
                    s.status === 'aktif' ? 'bg-hijau-tint text-hijau' : 'bg-garis-2 text-teks-3'}`}>
                    <Ikon nama="sesi" className="w-4.25 h-4.25" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-bold text-tinta">{labelWaktu(s.dibuatPada)}, {jamMenit(s.dibuatPada)}</span>
                    <span className="block text-[12.5px] text-teks-3">{s.muridJoined.length} murid · {st.label}</span>
                  </span>
                  <Ikon nama="kanan" className="w-4 h-4 text-pinggir" tebal={2.2} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

function Kosong({ ikon, judul, pesan }: { ikon: 'soal' | 'sesi' | 'cari'; judul: string; pesan: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-biru-tint flex items-center justify-center">
        <Ikon nama={ikon} className="w-8 h-8 text-biru" tebal={1.5} />
      </div>
      <div>
        <p className="text-[15px] font-bold text-tinta">{judul}</p>
        <p className="text-[13px] text-teks-3 mt-1 max-w-xs leading-relaxed">{pesan}</p>
      </div>
    </div>
  )
}
