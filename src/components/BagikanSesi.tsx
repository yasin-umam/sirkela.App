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

function TombolKecil({ ikon, label, onClick }: { ikon: 'qr' | 'duplikat' | 'bagikan'; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold active:scale-95 hover:bg-indigo-100 transition-all">
      <Ikon nama={ikon} className="w-3.5 h-3.5" tebal={2} />{label}
    </button>
  )
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
      kabari('QR gagal dibuat, pakai kode')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {qrSebaris && (
          <button type="button" onClick={() => void tampilkanQr()} aria-label="Perbesar QR"
            className="w-24 h-24 shrink-0 rounded-2xl border border-slate-100 bg-white p-1.5 flex items-center justify-center active:scale-95 transition-transform">
            {qrKecil
              ? <img src={qrKecil} alt="QR sesi" className="w-full h-full" />
              : <Ikon nama="qr" className="w-9 h-9 text-slate-200" />}
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kode sesi</p>
          <p className="text-3xl font-mono font-bold text-slate-800 tracking-[0.12em] select-all">{kode}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
        <Ikon nama="tautan" className="w-4 h-4 text-slate-400 shrink-0" />
        <input readOnly value={url} onFocus={e => e.currentTarget.select()}
          className="flex-1 min-w-0 bg-transparent text-xs text-slate-600 outline-none" />
      </div>

      <div className="flex flex-wrap gap-2">
        <TombolKecil ikon="qr" label="QR layar penuh" onClick={() => void tampilkanQr()} />
        <TombolKecil ikon="duplikat" label="Salin link" onClick={() => void salin()} />
        {bisaShare && <TombolKecil ikon="bagikan" label="Bagikan" onClick={() => void bagikan()} />}
      </div>
      {status && <p className="text-xs font-medium text-emerald-600 -mt-1">{status}</p>}

      {/* Dihadapkan ke kelas: QR sebesar mungkin, dan KODE tetap tercetak besar
          untuk kamera yang tidak bisa membacanya. */}
      {qrPenuh && (
        <div className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-center gap-5 px-6"
          onClick={() => setQrPenuh(null)}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pindai untuk bergabung</p>
          <img src={qrPenuh} alt="QR sesi" className="w-full max-w-xs sm:max-w-md aspect-square object-contain" />
          <div className="text-center">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">atau masukkan kode</p>
            <p className="text-5xl sm:text-6xl font-mono font-bold text-slate-800 tracking-[0.15em] mt-1">{kode}</p>
          </div>
          <p className="text-xs text-slate-400">Ketuk di mana saja untuk menutup</p>
        </div>
      )}
    </div>
  )
}
