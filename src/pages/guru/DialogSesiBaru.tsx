import { useState } from 'react'
import { useFormulir } from '../../context/FormulirContext'
import { labelWaktu } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { Spinner } from '../../components/ui/Spinner'
import { DialogKirim } from './DialogKirim'

// ─── Mulai sesi baru (dari kartu Sesi di Menu) ───────────────────────────────
// Sesi tetap hanya lahir dari formulir lewat Kirim (F2), jadi jalan pintas dari
// Menu cuma melompati editor: guru memilih formulirnya, lalu langsung sampai di
// DialogKirim yang SAMA dengan tombol Kirim di editor (pilihan Sesi Mandiri /
// Super Sesi, pemeriksaan kelengkapan, snapshot soal). Tidak ada jalur kedua
// yang membuka sesi.

export function DialogSesiBaru({ onTutup, onBaru, onPerbaiki, onPantauSesi }: {
  onTutup: () => void
  /** Belum punya formulir sama sekali: antar ke pembuatan formulir baru. */
  onBaru: () => void
  /** Soal belum lengkap: antar ke editor formulir yang dipilih. */
  onPerbaiki: () => void
  onPantauSesi: (sesiId: string) => void
}) {
  const { daftar, memuat, memuatSoal, pilihFormulir } = useFormulir()
  const [dipilih, setDipilih] = useState(false)

  if (dipilih) {
    // DialogKirim memeriksa `soal` formulir aktif: sebelum soalnya selesai
    // dimuat ia akan keliru mengatakan "belum punya pertanyaan".
    if (memuatSoal) {
      return (
        <Dialog judul="Menyiapkan formulir" onTutup={onTutup}>
          <div className="py-6 flex justify-center text-biru"><Spinner size={26} /></div>
        </Dialog>
      )
    }
    return <DialogKirim onTutup={onTutup} onPerbaiki={() => onPerbaiki()} onPantauSesi={onPantauSesi} />
  }

  return (
    <Dialog judul="Mulai sesi baru" onTutup={onTutup} lebar="max-w-lg"
      aksi={daftar.length === 0
        ? <>
            <Button variant="ghost" onClick={onTutup}>Batal</Button>
            <Button onClick={onBaru}>Buat formulir</Button>
          </>
        : <Button variant="ghost" onClick={onTutup}>Batal</Button>}>
      {memuat && daftar.length === 0 ? (
        <div className="py-6 flex justify-center text-biru"><Spinner size={26} /></div>
      ) : daftar.length === 0 ? (
        <p>
          Sesi lahir dari formulir, dan kamu belum punya satu pun. Buat formulir dulu, lalu tekan
          Kirim.
        </p>
      ) : (
        <>
          <p>Pilih formulir yang soalnya mau dikerjakan murid.</p>
          <div className="mt-3 rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
            {daftar.map(f => (
              <button key={f.id} type="button"
                onClick={() => { pilihFormulir(f.id); setDipilih(true) }}
                className="w-full text-left flex items-center gap-3 px-4 py-3.5 active:bg-isian transition-colors">
                <span className="w-11 h-11 rounded-xl bg-biru-tint text-biru flex items-center justify-center shrink-0">
                  <Ikon nama="dokumen" className="w-5.5 h-5.5" />
                </span>
                <span className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                  <span className="text-[15px] font-bold leading-snug text-tinta break-words">
                    {f.judul.trim() || 'Formulir tanpa judul'}
                  </span>
                  <span className="text-[13px] text-teks-3">
                    {f.jumlahSoal} pertanyaan · {labelWaktu(f.diperbaruiPada)}
                  </span>
                </span>
                <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0" tebal={2.2} />
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  )
}
