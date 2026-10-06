import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useKembali } from '../context/NavContext'
import { urlGambarSoal } from '../lib/gambarSoal'
import { Button } from './ui/Button'
import { Ikon, TombolIkon } from './ui/Ikon'

// ─── Gambar di bawah teks pertanyaan ─────────────────────────────────────────
// Dipakai layar murid, pratinjau guru, editor, dan tinjauan nilai -- satu
// komponen supaya yang dilihat guru di editor persis yang dilihat murid.
//
// Dua hal yang khas untuk ujian, bukan hiasan:
//  - Gambar yang gagal dimuat (wifi sekolah goyang) menampilkan tombol muat ulang.
//    Tanpa itu murid menatap kartu soal yang kosong dan tidak tahu harus apa.
//  - Ketuk untuk memperbesar. Viewport halaman ini mengunci pinch-zoom
//    (user-scalable=no), jadi diagram bertulisan kecil cuma bisa dibaca lewat
//    tampilan sendiri ini.

interface PropsGambar {
  /** Path di bucket `gambar-soal` (kolom `gambar` soal). */
  path: string
  /** `kecil` untuk tinjauan guru yang padat. */
  ukuran?: 'kecil' | 'normal'
  className?: string
}

/**
 * `key={path}`: gambar lain mulai dari keadaan bersih lewat mount ulang, BUKAN
 * lewat efek yang mereset state. Efek reset berjalan SESUDAH gambar dari cache
 * sudah memicu onLoad, lalu menimpa "termuat" kembali ke false dan gambarnya
 * tetap transparan selamanya (ketemu saat diuji di browser).
 */
export function GambarSoal(props: PropsGambar) {
  return <GambarSoalDalam key={props.path} {...props} />
}

function GambarSoalDalam({ path, ukuran = 'normal', className = '' }: PropsGambar) {
  const [termuat, setTermuat] = useState(false)
  const [gagal, setGagal] = useState(false)
  // Penambah query supaya "muat ulang" benar-benar meminta lagi, bukan mengambil
  // kegagalan yang tersimpan di cache browser.
  const [percobaan, setPercobaan] = useState(0)
  const [diperbesar, setDiperbesar] = useState(false)

  const dasar = urlGambarSoal(path)
  const url = percobaan > 0 ? `${dasar}?u=${percobaan}` : dasar
  const tinggi = ukuran === 'kecil' ? 'max-h-40' : 'max-h-96'

  if (gagal) {
    return (
      <div className={`rounded-xl border border-jingga-garis bg-jingga-tipis px-4 py-5 flex flex-col items-center gap-2 text-center ${className}`}>
        <Ikon nama="galat" className="w-6 h-6 text-jingga" tebal={1.6} />
        <p className="text-[13px] font-semibold text-jingga-gelap">Gambar belum termuat</p>
        <Button variant="secondary" size="sm" onClick={() => { setGagal(false); setTermuat(false); setPercobaan(n => n + 1) }}>
          <Ikon nama="muatUlang" className="w-4 h-4" />Muat ulang gambar
        </Button>
      </div>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setDiperbesar(true)} aria-label="Perbesar gambar soal"
        className={`relative block w-full overflow-hidden rounded-xl border border-garis bg-isian ${termuat ? '' : 'min-h-28'} ${className}`}>
        {/* ref: gambar yang sudah ada di cache bisa selesai sebelum onLoad terpasang. */}
        <img src={url} alt="Gambar soal" draggable={false}
          ref={el => { if (el?.complete && el.naturalWidth > 0) setTermuat(true) }}
          onLoad={() => setTermuat(true)} onError={() => setGagal(true)}
          className={`mx-auto block w-auto max-w-full object-contain ${tinggi} ${termuat ? '' : 'opacity-0'}`} />
        {termuat && ukuran === 'normal' && (
          <span className="absolute bottom-2 right-2 rounded-md bg-tinta/75 px-2 py-1 text-[11px] font-bold text-white">
            Ketuk untuk memperbesar
          </span>
        )}
      </button>
      {diperbesar && <GambarPenuh url={url} onTutup={() => setDiperbesar(false)} />}
    </>
  )
}

/**
 * Lapisan layar penuh. Lewat portal ke <body>: layar murid membungkus soal dengan
 * `zoom` (TombolZoom), dan `position: fixed` di dalam wadah ber-zoom ikut
 * membesar dan salah ukuran.
 */
function GambarPenuh({ url, onTutup }: { url: string; onTutup: () => void }) {
  const [besar, setBesar] = useState(false)

  // Tombol kembali menutup gambar, bukan keluar dari layar di belakangnya --
  // terutama saat sesi berkunci, ketika Back sengaja ditelan.
  useKembali(() => { onTutup(); return true }, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  return createPortal(
    <div role="dialog" aria-modal aria-label="Gambar soal" className="fixed inset-0 z-60 flex flex-col bg-tinta/95">
      <div className="h-14 shrink-0 flex items-center justify-between px-2">
        <TombolIkon nama="tutup" label="Tutup gambar" onClick={onTutup} ukuran="w-5 h-5"
          className="text-white hover:bg-white/10 hover:text-white" />
        <button type="button" onClick={() => setBesar(b => !b)}
          className="h-10 px-4 rounded-xl text-sm font-bold text-white hover:bg-white/10 transition-colors">
          {besar ? 'Pas layar' : 'Perbesar'}
        </button>
      </div>
      {/* m-auto pada gambar (bukan items-center): saat gambar lebih lebar dari
          layar, margin otomatis jatuh ke nol dan sisi kirinya tetap terjangkau. */}
      <div className="flex-1 min-h-0 flex overflow-auto overscroll-contain p-2" onClick={() => setBesar(b => !b)}>
        <img src={url} alt="Gambar soal" draggable={false}
          className={`m-auto rounded-lg bg-white ${besar
            ? 'w-[250%] max-w-none h-auto cursor-zoom-out'
            : 'max-w-full max-h-[calc(100dvh-5rem)] object-contain cursor-zoom-in'}`} />
      </div>
    </div>,
    document.body,
  )
}
