import type { ReactNode } from 'react'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'

/**
 * Konfirmasi untuk aksi yang tidak bisa dibatalkan ("hapus formulir", "akhiri
 * sesi", "keluar"). Satu komponen supaya kalimat tombolnya selalu
 * "Batal" + kata kerja aksinya, tidak pernah "Ya/Tidak".
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
    <Dialog
      judul={judul}
      onTutup={sibuk ? undefined : onBatal}
      aksi={<>
        <Button variant="ghost" onClick={onBatal} disabled={sibuk}>Batal</Button>
        <Button variant="danger" onClick={onAksi} disabled={sibuk}>
          {sibuk ? 'Memproses...' : labelAksi}
        </Button>
      </>}
    >
      {pesan}
    </Dialog>
  )
}
