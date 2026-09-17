import { useEffect, useState } from 'react'
import { useKembali } from '../context/NavContext'
import { urlGabungSesi } from '../lib/sesiCapture'
import { bagikanTeks } from '../lib/fileShare'
import { NAMA_APLIKASI } from '../lib/aplikasi'
import { Ikon } from './ui/Ikon'

// ─── Kode, QR, dan link sebuah sesi ──────────────────────────────────────────
// Tiga jalan masuk untuk tiga keadaan kelas: QR untuk murid di ruangan, link
// untuk yang tidak, KODE untuk HP yang tidak bisa membuka keduanya. Ketiganya
// selalu tampil bersama.

async function buatQr(kode: string, lebar: number): Promise<string> {
  // Diimpor dinamis: guru yang tidak pernah menampilkan QR tidak ikut mengunduhnya.
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(urlGabungSesi(kode), { width: lebar, margin: 1, errorCorrectionLevel: 'M' })
}

export function BagikanSesi({ kode, qrSebaris = false }: { kode: string; qrSebaris?: boolean }) {
  const [status, setStatus] = useState<string | null>(null)
  const [qrPenuh, setQrPenuh] = useState<string | null>(null)
  const [qrKecil, setQrKecil] = useState<string | null>(null)
  const bisaShare = typeof navigator.share === 'function'
  const url = urlGabungSesi(kode)

  useEffect(() => {
    if (!qrSebaris) return
    let batal = false
    buatQr(kode, 320).then(q => { if (!batal) setQrKecil(q) }).catch(() => { /* kode & link tetap ada */ })
    return () => { batal = true }
  }, [kode, qrSebaris])

  useKembali(() => {
    if (!qrPenuh) return false
    setQrPenuh(null)
    return true
  })

  function kabari(teks: string) {
    setStatus(teks)
    setTimeout(() => setStatus(null), 2000)
  }

  async function salin() {
    try {
      await navigator.clipboard.writeText(url)
      kabari('Link disalin')
    } catch {
      // Clipboard butuh konteks aman + izin. Link-nya tetap bisa diseleksi manual.
      kabari('Salin manual link di atas')
    }
  }

  async function bagikan() {
    const teks = `Gabung sesi kelas: ${url}\n\nAtau masukkan kode ${kode} di ${NAMA_APLIKASI}.`
    const hasil = await bagikanTeks(`Sesi Kelas ${NAMA_APLIKASI}`, teks, url)
    if (hasil === 'tidak-didukung') await salin()
  }

  async function tampilkanQr() {
    try {
      // 720px supaya tetap tajam saat diproyeksikan ke layar kelas.
      setQrPenuh(await buatQr(kode, 720))
    } catch {
      kabari('QR gagal dibuat — pakai kode')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {qrSebaris && (
          <button type="button" onClick={() => void tampilkanQr()} aria-label="Perbesar QR"
            className="w-28 h-28 shrink-0 rounded-md border border-garis bg-white p-1 flex items-center justify-center">
            {qrKecil ? <img src={qrKecil} alt="QR sesi" className="w-full h-full" /> : <Ikon nama="qr" className="w-10 h-10 text-slate-300" />}
          </button>
        )}
        <div className="min-w-0">
          <p className="text-xs text-teks-2">Kode sesi</p>
          <p className="text-3xl desktop:text-4xl font-mono font-bold text-teks tracking-[0.12em] select-all">{kode}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-garis pb-1.5">
        <Ikon nama="tautan" className="w-5 h-5 text-teks-2" />
        <input readOnly value={url} onFocus={e => e.currentTarget.select()}
          className="flex-1 min-w-0 bg-transparent text-sm text-teks outline-none" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void tampilkanQr()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-garis text-sm font-medium text-indigo-600 hover:bg-indigo-50">
          <Ikon nama="qr" className="w-4.5 h-4.5" />QR layar penuh
        </button>
        <button type="button" onClick={() => void salin()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-garis text-sm font-medium text-indigo-600 hover:bg-indigo-50">
          <Ikon nama="duplikat" className="w-4.5 h-4.5" />Salin link
        </button>
        {bisaShare && (
          <button type="button" onClick={() => void bagikan()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-garis text-sm font-medium text-indigo-600 hover:bg-indigo-50">
            <Ikon nama="bagikan" className="w-4.5 h-4.5" />Bagikan
          </button>
        )}
      </div>
      {status && <p className="text-xs text-benar -mt-2">{status}</p>}

      {/* Dihadapkan ke kelas: QR sebesar mungkin, dan KODE tetap tercetak besar
          untuk kamera yang tidak bisa membacanya. */}
      {qrPenuh && (
        <div className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-center gap-5 px-6" onClick={() => setQrPenuh(null)}>
          <p className="text-sm font-medium text-teks-2 uppercase tracking-widest">Pindai untuk bergabung</p>
          <img src={qrPenuh} alt="QR sesi" className="w-full max-w-xs sm:max-w-md aspect-square object-contain" />
          <div className="text-center">
            <p className="text-xs text-teks-2 uppercase tracking-widest">atau masukkan kode</p>
            <p className="text-5xl sm:text-6xl font-mono font-bold text-teks tracking-[0.15em] mt-1">{kode}</p>
          </div>
          <p className="text-xs text-teks-2">Ketuk di mana saja untuk menutup</p>
        </div>
      )}
    </div>
  )
}
