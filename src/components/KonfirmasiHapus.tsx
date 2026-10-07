import { useState } from 'react'
import type { ReactNode } from 'react'
import { useKembali } from '../context/NavContext'
import { LembarKonfirmasi } from './LembarKonfirmasi'

/**
 * Konfirmasi "hapus riwayat" (formulir, sesi, Super Sesi): satu komponen supaya
 * ketiganya menangani hal yang sama dengan cara yang sama -- tombol berhenti selama
 * menghapus, pesan galat server tampil DI DALAM lembarnya (bukan hilang), dan tombol
 * kembali perangkat menutupnya (kecuali sedang menghapus).
 *
 * `onHapus` harus MELEMPAR kalau gagal. Sesudah sukses lembar langsung ditutup;
 * pemanggil biasanya sudah membuang barisnya dari daftar, jadi komponen ini tidak
 * menyentuh state-nya sendiri lagi (bisa saja sudah tak ter-mount).
 */
export function KonfirmasiHapus({ judul, pesan, onHapus, onTutup }: {
  judul: string
  pesan: ReactNode
  onHapus: () => Promise<void>
  onTutup: () => void
}) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useKembali(() => { if (!sibuk) onTutup(); return true })

  async function jalankan() {
    setSibuk(true); setGalat(null)
    try {
      await onHapus()
      onTutup()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghapus. Coba lagi.')
      setSibuk(false)
    }
  }

  return (
    <LembarKonfirmasi
      judul={judul}
      pesan={<>
        {pesan}
        {galat && <span className="block mt-3 font-medium text-jingga-gelap">{galat}</span>}
      </>}
      labelAksi="Hapus"
      sibuk={sibuk}
      onAksi={() => void jalankan()}
      onBatal={onTutup}
    />
  )
}
