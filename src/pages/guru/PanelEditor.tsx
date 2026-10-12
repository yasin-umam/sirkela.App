import type { Formulir, Soal } from '../../types'
import { kelasButuhJurusan, masalahFormulir, masalahSoal } from '../../lib/soal'
import { Gelembung } from '../../components/Gelembung'
import { GambarSoal } from '../../components/GambarSoal'
import { TeksSoal } from '../../components/TeksSoal'
import { teksPolosSoal } from '../../lib/teksMatematika'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Eyebrow } from '../../components/ui/Eyebrow'

// ─── Panel samping editor formulir (desktop, ≥ 1024px) ───────────────────────
// Editor desktop punya tiga kolom: rel pertanyaan di kiri (RelPertanyaan),
// kartu-kartu pertanyaan di tengah (TabPertanyaan, yang juga dipakai HP), dan
// panel "Siap dikirim?" di kanan (PanelKirim). Keduanya turunan MURNI dari data
// formulir yang sudah ada (soal, masalahSoal, masalahFormulir) -- tidak ada
// keadaan atau pemanggilan server baru. Di HP komponen ini tidak dirender.

function kapital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Daftar nomor pertanyaan: ketuk untuk melompat, ikon menandai yang belum lengkap. */
export function RelPertanyaan({ soal, aktifId, onPilih, onTambah }: {
  soal: Soal[]
  aktifId: string | null
  onPilih: (id: string) => void
  onTambah: () => void
}) {
  const berkunci = soal.filter(s => s.jawabanBenar !== null).length
  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-1.5 bg-white border-r border-garis px-4 py-5.5 overflow-y-auto hide-scrollbar">
      <Eyebrow className="px-1">Pertanyaan · {soal.length}</Eyebrow>
      {/* Berapa soal yang sudah punya kunci: yang paling sering menahan Kirim. */}
      {soal.length > 0 && (
        <div className="px-1 pt-2 pb-2.5">
          <div className="flex justify-between text-[12.5px] text-tinta-2">
            <span>Kunci jawaban</span>
            <span className="font-extrabold text-tinta">{berkunci} dari {soal.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-biru-tint overflow-hidden mt-1.5">
            <div className="h-full bg-biru" style={{ width: `${(berkunci / soal.length) * 100}%` }} />
          </div>
        </div>
      )}
      {soal.length === 0 && (
        <p className="text-[13px] text-teks-3 leading-relaxed px-1 mt-2">Belum ada pertanyaan. Tulis satu, atau impor dari luar lewat tombol Impor soal di atas.</p>
      )}
      {soal.map((s, i) => {
        const masalah = masalahSoal(s)
        const nyala = aktifId === s.id
        return (
          <button key={s.id} type="button" onClick={() => onPilih(s.id)} aria-current={nyala ? 'true' : undefined}
            title={masalah ? kapital(masalah) : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-[1.5px] text-left transition-colors ${
              nyala ? 'border-biru bg-biru-tipis' : 'border-transparent hover:bg-isian'}`}>
            <span className={`shrink-0 rounded-[7px] px-1.75 py-0.5 font-mono text-[12.5px] font-medium text-white ${nyala ? 'bg-biru' : 'bg-tinta'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={`flex-1 min-w-0 text-[13.5px] leading-snug line-clamp-3 break-words ${
              s.pertanyaan.trim() ? (nyala ? 'font-bold text-tinta' : 'text-tinta') : 'text-teks-3 italic'}`}>
              {s.pertanyaan.trim() ? teksPolosSoal(s.pertanyaan) : 'Pertanyaan kosong'}
            </span>
            {masalah
              ? <Ikon nama="galat" className="w-4.5 h-4.5 text-jingga shrink-0" tebal={2.2} />
              : <Ikon nama="centang" className="w-4.5 h-4.5 text-hijau shrink-0" tebal={3} />}
          </button>
        )
      })}
      <button type="button" onClick={onTambah}
        className="mt-2.5 h-11.5 rounded-xl border-[1.5px] border-dashed border-pinggir text-sm font-bold text-biru flex items-center justify-center gap-1.75 hover:bg-biru-tipis transition-colors">
        <Ikon nama="tambah" className="w-4 h-4" tebal={2.4} />Tambah pertanyaan
      </button>
    </aside>
  )
}

function Cek({ ok, judul, keterangan }: { ok: boolean; judul: string; keterangan?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-px ${
        ok ? 'bg-hijau-tint text-hijau' : 'bg-jingga-tint text-jingga'}`}>
        <Ikon nama={ok ? 'centang' : 'galat'} className="w-3.5 h-3.5" tebal={3} />
      </span>
      <span>
        <span className={`block text-[14.5px] ${ok ? 'font-semibold text-tinta' : 'font-extrabold text-jingga-gelap'}`}>{judul}</span>
        {keterangan && <span className="block text-[13px] text-teks-3 mt-px">{keterangan}</span>}
      </span>
    </div>
  )
}

/** Kartu "Siap dikirim?" + pratinjau kecil tampilan murid. */
export function PanelKirim({ formulir, soal, aktifId, onKirim }: {
  formulir: Formulir
  soal: Soal[]
  aktifId: string | null
  onKirim: () => void
}) {
  const masalahForm = masalahFormulir(formulir)
  const bermasalah = soal.map((s, i) => ({ nomor: i + 1, masalah: masalahSoal(s) })).filter(x => x.masalah)
  const berkunci = soal.filter(s => s.jawabanBenar !== null).length
  const contoh = soal.find(s => s.id === aktifId) ?? soal[0]

  return (
    <aside className="hidden lg:flex w-85 shrink-0 flex-col gap-4.5 py-5.5 pr-5.5 overflow-y-auto hide-scrollbar">
      <div className="bg-white rounded-[18px] border border-garis p-5.5 flex flex-col gap-4">
        <p className="text-[17px] font-extrabold tracking-tight text-tinta">Siap dikirim?</p>
        <Cek ok={!masalahForm} judul={masalahForm ? kapital(masalahForm)
          : kelasButuhJurusan(formulir.kelas) ? 'Judul, kelas, jurusan, dan mapel terisi' : 'Judul, kelas, dan mapel terisi'} />
        <Cek ok={soal.length > 0} judul={soal.length > 0 ? `${soal.length} pertanyaan` : 'Belum ada pertanyaan'} />
        <Cek ok={soal.length > 0 && bermasalah.length === 0}
          judul={bermasalah.length > 0 ? `${bermasalah.length} pertanyaan belum lengkap` : `Kunci jawaban: ${berkunci} dari ${soal.length}`}
          keterangan={bermasalah.length > 0 ? `Soal ${String(bermasalah[0].nomor).padStart(2, '0')}: ${bermasalah[0].masalah}` : undefined} />
        <Button size="lg" fullWidth onClick={onKirim} className="h-13!">
          <Ikon nama="kirim" className="w-4.5 h-4.5" />Kirim formulir
        </Button>
      </div>

      {/* Seperti ini yang dilihat murid: cuma gambaran bentuknya (kepala sesi +
          satu soal dengan gelembungnya), bukan pratinjau penuh -- itu tetap
          lewat tombol Pratinjau di kepala editor. */}
      <div className="bg-white rounded-[18px] border border-garis p-5 flex flex-col gap-3">
        <Eyebrow>Seperti ini dilihat murid</Eyebrow>
        <div className="bg-alas rounded-[14px] p-3 flex flex-col gap-2.5">
          <div className="bg-tinta rounded-xl px-3.5 py-3 text-white">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-biru-muda">Sesi kelas</p>
            <p className="text-[15px] font-extrabold tracking-tight leading-snug mt-0.5 break-words">
              {formulir.judul.trim() || 'Formulir tanpa judul'}
            </p>
          </div>
          {contoh ? (
            <div className="bg-white rounded-xl border border-garis p-3 flex flex-col gap-2">
              <div className="flex gap-2 items-start">
                <span className="shrink-0 rounded-[5px] bg-tinta px-1.5 py-px font-mono text-[10.5px] font-medium text-white">
                  {String(soal.indexOf(contoh) + 1).padStart(2, '0')}
                </span>
                <p className="text-[12.5px] font-semibold leading-snug text-tinta break-words">
                  {contoh.pertanyaan.trim() ? <TeksSoal teks={contoh.pertanyaan} /> : 'Pertanyaan'}
                </p>
              </div>
              {contoh.gambar && <GambarSoal path={contoh.gambar} ukuran="kecil" />}
              {contoh.pilihan.map((p, j) => (
                <div key={j} className="flex items-center gap-2 rounded-lg border border-garis px-2 py-1.5">
                  <Gelembung indeks={j} ukuran="sm" />
                  <span className="text-xs text-tinta break-words min-w-0">
                    {p.trim() ? <TeksSoal teks={p} besar /> : 'Opsi kosong'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-teks-3 px-1 py-2">Soal pertamamu akan tampil di sini.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
