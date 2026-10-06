import { useState } from 'react'
import type { SesiKelas } from '../types'
import { useSesi } from '../context/SesiContext'
import { useAksiGuru } from '../context/AksiGuruContext'
import { useDesktop } from '../lib/useDesktop'
import { hitungPeserta } from '../lib/keadaanSesi'
import { menitDetik, useSisaDetik } from '../lib/waktuSesi'
import { Ikon, type NamaIkon } from './ui/Ikon'

// ─── Bilah atas guru (desktop, ≥ 1024px) ─────────────────────────────────────
// Dipasang oleh TIAP halaman di bagian paling atasnya (bukan sekali di GuruHome),
// supaya halaman sendiri yang menentukan judulnya -- mis. layar Jawaban & nilai
// memakai jejak "Sesi › judul › Jawaban & nilai". Di HP ia tidak dirender sama
// sekali (halaman HP punya bilah kembalinya sendiri).
//
// Isinya: judul/jejak di kiri; di kanan pil sesi yang sedang berjalan (kode, sisa
// waktu, murid terkunci) dan tombol "Formulir baru" yang punya menu cara lain.
// Pil itu satu-satunya penanda di layar-layar lain bahwa ada ulangan yang masih
// berlangsung -- guru yang sedang menulis soal berikutnya tetap melihat
// tenggatnya. Halaman yang SUDAH menampilkan sesinya (Menu, Sesi) mematikannya
// lewat `tanpaSesi`.

export interface LangkahJejak {
  label: string
  /** Tanpa onClick = halaman sekarang (langkah terakhir). */
  onClick?: () => void
}

export function BilahAtas({ judul, jejak, tanpaSesi = false }: {
  judul?: string
  jejak?: LangkahJejak[]
  tanpaSesi?: boolean
}) {
  const desktop = useDesktop()
  if (!desktop) return null

  return (
    <header className="h-16 shrink-0 bg-white border-b border-garis flex items-center gap-4 px-8">
      {jejak ? (
        <nav aria-label="Jejak halaman" className="flex items-center gap-2 text-sm text-teks-3 min-w-0">
          {jejak.map((l, i) => {
            const terakhir = i === jejak.length - 1
            return (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <Ikon nama="kanan" className="w-3.5 h-3.5 shrink-0" tebal={2.4} />}
                {l.onClick && !terakhir
                  ? <button type="button" onClick={l.onClick} className="font-semibold hover:text-tinta transition-colors truncate">{l.label}</button>
                  : <span className={`truncate ${terakhir ? 'font-extrabold text-tinta text-[15px]' : 'font-semibold'}`}>{l.label}</span>}
              </span>
            )
          })}
        </nav>
      ) : (
        <h1 className="text-[19px] font-extrabold tracking-tight text-tinta">{judul}</h1>
      )}
      <div className="flex-1" />
      {!tanpaSesi && <PilSesi />}
      <TombolFormulirBaru />
    </header>
  )
}

// ─── Pil sesi berjalan ───────────────────────────────────────────────────────

function PilSesi() {
  const { semuaSesi } = useSesi()
  const { bukaSesi } = useAksiGuru()
  const berjalan = semuaSesi.filter(s => s.status === 'aktif' && s.mulaiPada)
  if (berjalan.length === 0) return null
  return <PilIsi sesi={berjalan[0]} lainnya={berjalan.length - 1} onClick={() => bukaSesi(berjalan[0].id)} />
}

function PilIsi({ sesi, lainnya, onClick }: { sesi: SesiKelas; lainnya: number; onClick: () => void }) {
  const sisa = useSisaDetik(sesi.mulaiPada, sesi.durasiMenit)
  const terkunci = sesi.kunciLayar ? hitungPeserta(sesi).terkunci : 0
  const label = `Sesi berjalan ${sesi.kodeJoin}${sisa != null ? `, sisa ${menitDetik(sisa)}` : ''}${terkunci > 0 ? `, ${terkunci} murid terkunci` : ''}`
  return (
    <button type="button" onClick={onClick} aria-label={label} title={sesi.judul}
      className="h-10.5 pl-3 pr-3 rounded-xl bg-tinta text-white inline-flex items-center gap-3 text-[13.5px] hover:bg-tinta-2 transition-colors">
      <span className="w-2 h-2 rounded-full bg-hijau-muda" />
      <span className="font-mono font-medium tracking-[0.06em]">{sesi.kodeJoin}</span>
      {sisa != null && (
        <span className={`font-mono tabular-nums ${sisa < sesi.durasiMenit * 12 ? 'text-jingga-garis' : 'text-biru-muda'}`}>{menitDetik(sisa)}</span>
      )}
      {terkunci > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jingga-tint text-jingga-gelap text-xs font-extrabold">
          <Ikon nama="kunci" className="w-3 h-3" tebal={2.6} />{terkunci}
        </span>
      )}
      {lainnya > 0 && <span className="text-xs text-biru-muda">+{lainnya} sesi</span>}
    </button>
  )
}

// ─── Formulir baru ▾ ─────────────────────────────────────────────────────────

const CARA: { id: 'ai' | 'teks' | 'pdf'; ikon: NamaIkon; judul: string; keterangan: string }[] = [
  { id: 'ai', ikon: 'ai', judul: 'Generate dari topik', keterangan: 'AI menulis soal dari topik' },
  { id: 'teks', ikon: 'impor', judul: 'Tempel dari Google Form', keterangan: 'Salin teks halaman responden' },
  { id: 'pdf', ikon: 'dokumen', judul: 'Unggah PDF', keterangan: 'Dibaca AI, maksimal 15 MB' },
]

function TombolFormulirBaru() {
  const { formulirBaru, imporDariLuar, membuat } = useAksiGuru()
  const [buka, setBuka] = useState(false)

  return (
    <div className="relative">
      <div className="flex">
        <button type="button" onClick={formulirBaru} disabled={membuat}
          className="h-10.5 px-4 rounded-l-xl bg-biru text-white text-[14.5px] font-bold inline-flex items-center gap-2 hover:bg-biru-gelap transition-colors disabled:opacity-60">
          <Ikon nama="tambah" className="w-4.25 h-4.25" tebal={2.4} />{membuat ? 'Membuat…' : 'Formulir baru'}
        </button>
        <button type="button" onClick={() => setBuka(v => !v)} aria-label="Cara lain membuat formulir"
          aria-expanded={buka} aria-haspopup="menu"
          className="w-10 h-10.5 rounded-r-xl bg-biru text-white border-l border-white/30 inline-flex items-center justify-center hover:bg-biru-gelap transition-colors">
          <Ikon nama="bawah" className="w-4 h-4" tebal={2.4} />
        </button>
      </div>

      {buka && (
        <>
          {/* Latar tak kasat mata: ketuk di luar menu = menutupnya. */}
          <button type="button" aria-label="Tutup menu" onClick={() => setBuka(false)}
            onKeyDown={e => { if (e.key === 'Escape') setBuka(false) }}
            className="fixed inset-0 z-30 cursor-default" />
          <div role="menu" className="absolute right-0 top-12.5 z-40 w-85 bg-white rounded-2xl border border-garis shadow-lg p-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 px-2.5 pt-2 pb-1.5">Atau bawa dari luar</p>
            {CARA.map(c => (
              <button key={c.id} type="button" role="menuitem"
                onClick={() => { setBuka(false); imporDariLuar(c.id) }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-isian transition-colors">
                <span className="w-9.5 h-9.5 rounded-[11px] bg-biru-tint text-biru flex items-center justify-center shrink-0">
                  <Ikon nama={c.ikon} className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-[14.5px] font-bold text-tinta">{c.judul}</span>
                  <span className="block text-[13px] text-teks-3 mt-px">{c.keterangan}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
