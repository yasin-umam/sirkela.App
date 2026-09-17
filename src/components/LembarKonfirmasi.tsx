import type { ReactNode } from 'react'

/**
 * Lembar konfirmasi dari bawah -- satu komponen untuk "keluar tanpa menyimpan"
 * dan "hapus". Di Luang keduanya dua komponen hampir identik
 * (KonfirmasiKeluarBelumTersimpan & KonfirmasiHapus).
 */
export function LembarKonfirmasi({ judul, pesan, labelAksi, sibuk = false, onAksi, onBatal }: {
  judul: string
  pesan: ReactNode
  labelAksi: string
  sibuk?: boolean
  onAksi: () => void
  onBatal: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={sibuk ? undefined : onBatal} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-4 pt-4 pb-8 max-w-2xl mx-auto">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />
        <p className="text-sm font-bold text-slate-800 mb-1">{judul}</p>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">{pesan}</p>
        <div className="flex gap-2">
          <button
            onClick={onBatal}
            disabled={sibuk}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold active:bg-slate-200 transition-colors disabled:opacity-60"
          >
            Batal
          </button>
          <button
            onClick={onAksi}
            disabled={sibuk}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold active:bg-red-700 transition-colors disabled:opacity-60"
          >
            {sibuk ? 'Memproses...' : labelAksi}
          </button>
        </div>
      </div>
    </>
  )
}
