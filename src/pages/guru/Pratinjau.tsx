import { useState } from 'react'
import { useFormulir } from '../../context/FormulirContext'
import { HalamanResponden, KartuKepalaResponden, KartuSoalResponden } from '../../components/FormulirResponden'
import { Button } from '../../components/ui/Button'
import { TombolIkon } from '../../components/ui/Ikon'

// ─── Pratinjau (ikon mata) ───────────────────────────────────────────────────
// Komponen responden yang SAMA dengan layar murid. Pilihan di sini tidak
// disimpan ke mana pun -- tidak ada sesi, tidak ada identitas murid.

export function Pratinjau({ onTutup }: { onTutup: () => void }) {
  const { aktif, soal } = useFormulir()
  const [pilihan, setPilihan] = useState<Record<string, number>>({})
  const [pesan, setPesan] = useState(false)

  if (!aktif) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="h-14 shrink-0 bg-white border-b border-garis flex items-center gap-2 px-2">
        <TombolIkon nama="kembali" label="Tutup pratinjau" onClick={onTutup} />
        <p className="flex-1 text-base text-teks">Pratinjau</p>
        <p className="text-xs text-teks-2 pr-3">Jawaban di sini tidak disimpan</p>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <HalamanResponden>
          <KartuKepalaResponden judul={aktif.judul.trim() || 'Formulir tanpa judul'} deskripsi={aktif.deskripsi}>
            {soal.length} pertanyaan · {aktif.durasiMenit} menit
            <span className="block text-salah mt-1">* Menunjukkan pertanyaan yang wajib diisi</span>
          </KartuKepalaResponden>
          {soal.map(s => (
            <KartuSoalResponden key={s.id} pertanyaan={s.pertanyaan.trim() || 'Pertanyaan'} pilihan={s.pilihan}
              dipilih={pilihan[s.id]} onPilih={j => setPilihan(p => ({ ...p, [s.id]: j }))} />
          ))}
          <div className="flex items-center justify-between gap-3 pt-1 pb-8">
            <Button onClick={() => setPesan(true)}>Kirim</Button>
            <Button variant="teks" onClick={() => setPilihan({})}>Kosongkan formulir</Button>
          </div>
          {pesan && <p className="text-sm text-teks-2 -mt-6 pb-8">Ini pratinjau — murid mengirim dari layar mereka sendiri.</p>}
        </HalamanResponden>
      </div>
    </div>
  )
}
