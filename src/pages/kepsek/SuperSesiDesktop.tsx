import type { SuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { labelWaktu } from '../../lib/soal'
import { BilahAtas } from '../../components/BilahAtas'
import { Ikon } from '../../components/ui/Ikon'
import { DetailSuperSesi } from './DetailSuperSesi'

// ─── Layar Super Sesi desktop (≥ 1024px): daftar + detail ────────────────────
// Master-detail seperti layar Sesi: daftar Super Sesi tetap di kiri, kiriman &
// pengawasan Super Sesi terpilih di kanan. SuperSesiPage yang memilihkan yang
// bawaan (yang berjalan). HP memakai SuperSesiPage.

const STATUS: Record<SuperSesi['status'], { label: string; kelas: string }> = {
  berjalan: { label: 'Berjalan', kelas: 'bg-hijau-tint text-hijau' },
  mengumpulkan: { label: 'Mengumpulkan', kelas: 'bg-biru-tint text-biru' },
  selesai: { label: 'Selesai', kelas: 'bg-garis-2 text-tinta-2' },
}

export function SuperSesiDesktop({ onBuat }: { onBuat: () => void }) {
  const { semuaSuperSesi, memuat, fokus, fokuskan } = useSuperSesi()

  return (
    <div className="flex flex-col h-full bg-alas">
      <BilahAtas judul="Super Sesi" />
      {memuat && semuaSuperSesi.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-biru-muda border-t-biru rounded-full animate-spin" />
        </div>
      ) : semuaSuperSesi.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-biru-tint flex items-center justify-center">
            <Ikon nama="perisai" className="w-8 h-8 text-biru" tebal={1.5} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-tinta">Belum ada Super Sesi</p>
            <p className="text-[13px] text-teks-3 mt-1 max-w-xs leading-relaxed">
              Buat satu, lalu bagikan ke guru mapel supaya mereka bisa mengirim soal ulangan ke sini.
            </p>
          </div>
          <button type="button" onClick={onBuat}
            className="mt-1 h-11.5 px-5 rounded-xl bg-biru text-white text-[14.5px] font-bold hover:bg-biru-gelap transition-colors">
            Buat Super Sesi
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Lebar kolom menyempit di bawah xl (1280px) bersama sidebar yang jadi rel ikon, supaya
              kontainer "Murid terkunci" di DetailSuperSesi tetap muat di samping tabel kiriman. */}
          <nav aria-label="Daftar Super Sesi" className="w-52 xl:w-64 min-[1400px]:w-75 shrink-0 bg-white border-r border-garis px-3 xl:px-4 py-5 overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-1.5">
            <button type="button" onClick={onBuat}
              className="h-11 mb-2 rounded-xl border-[1.5px] border-dashed border-pinggir text-sm font-bold text-biru flex items-center justify-center gap-1.75 hover:bg-biru-tipis transition-colors">
              <Ikon nama="tambah" className="w-3.75 h-3.75" tebal={2.4} />Super Sesi baru
            </button>
            {semuaSuperSesi.map(s => {
              const st = STATUS[s.status]
              const terpilih = s.id === fokus?.id
              return (
                <button key={s.id} type="button" onClick={() => fokuskan(s.id)} aria-current={terpilih ? 'true' : undefined}
                  className={`w-full flex flex-col items-start gap-1.5 px-3.5 py-3 rounded-xl text-left transition-colors ${
                    terpilih ? 'bg-biru-tipis ring-[1.5px] ring-inset ring-biru' : 'hover:bg-isian'}`}>
                  <span className="text-[14.5px] font-bold leading-snug text-tinta">{s.judul}</span>
                  {/* flex-wrap: di kolom 208px lencana dan tanggal tidak muat sebaris; tanggal turun utuh. */}
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-teks-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.25 py-0.5 rounded-full text-xs font-bold ${st.kelas}`}>
                      {s.status === 'berjalan' && <span className="w-1.5 h-1.5 rounded-full bg-hijau" />}{st.label}
                    </span>
                    <span className="whitespace-nowrap">{labelWaktu(s.dibuatPada)}</span>
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="flex-1 min-w-0 min-h-0">
            {fokus && <DetailSuperSesi key={fokus.id} superSesi={fokus} onKembali={() => fokuskan(null)} />}
          </div>
        </div>
      )}
    </div>
  )
}
