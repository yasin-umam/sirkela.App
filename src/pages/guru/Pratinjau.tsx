import { useState } from 'react'
import { useFormulir } from '../../context/FormulirContext'
import { HalamanMurid, KartuKepalaMurid, KartuSoalMurid } from '../../components/LayarMurid'
import { Button } from '../../components/ui/Button'
import { TombolIkon } from '../../components/ui/Ikon'

// ─── Pratinjau (ikon mata) ───────────────────────────────────────────────────
// Komponen layar murid yang SAMA dengan yang dipakai KerjakanSesi. Pilihan di
// sini tidak disimpan ke mana pun -- tidak ada sesi, tidak ada identitas murid.

export function Pratinjau({ onTutup }: { onTutup: () => void }) {
  const { aktif, soal } = useFormulir()
  const [pilihan, setPilihan] = useState<Record<string, number>>({})
  const [pesan, setPesan] = useState(false)

  if (!aktif) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-alas">
      <div className="h-14 shrink-0 bg-white border-b border-garis flex items-center gap-2 px-2">
        <TombolIkon nama="kembali" label="Tutup pratinjau" onClick={onTutup} />
        <p className="flex-1 text-base font-bold text-tinta">Pratinjau layar murid</p>
        <p className="text-xs text-teks-3 pr-2">Jawaban di sini tidak disimpan</p>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar">
        <HalamanMurid>
          <KartuKepalaMurid penanda="Pratinjau" judul={aktif.judul.trim() || 'Formulir tanpa judul'} deskripsi={aktif.deskripsi}>
            {soal.length} pertanyaan · durasi ditentukan saat sesi dibuka
          </KartuKepalaMurid>
          {soal.map((s, i) => (
            <KartuSoalMurid key={s.id} nomor={i + 1} pertanyaan={s.pertanyaan.trim() || 'Pertanyaan'} pilihan={s.pilihan}
              dipilih={pilihan[s.id]} onPilih={j => setPilihan(p => ({ ...p, [s.id]: j }))} />
          ))}
          <div className="flex items-center gap-3 pt-1 pb-8">
            <Button size="lg" onClick={() => setPesan(true)}>Kirim</Button>
            <Button variant="ghost" onClick={() => setPilihan({})}>Kosongkan</Button>
          </div>
          {pesan && <p className="text-xs text-teks-3 -mt-6 pb-8">Ini pratinjau. Murid mengirim dari layar mereka sendiri.</p>}
        </HalamanMurid>
      </div>
    </div>
  )
}
