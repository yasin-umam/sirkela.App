import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormulir } from '../../context/FormulirContext'
import { Sakelar } from '../../components/ui/Sakelar'
import { Button } from '../../components/ui/Button'

// ─── Tab Setelan ─────────────────────────────────────────────────────────────
// Disimpan di formulir, dipakai sesi yang dibuka BERIKUTNYA. Sesi yang sedang
// berjalan diatur dari tab Jawaban (kunci layar bisa dimatikan di tengah sesi).

function Bagian({ judul, keterangan, children }: { judul: string; keterangan?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-lg border border-garis">
      <div className="px-5 desktop:px-6 pt-5 pb-3">
        <h2 className="text-lg text-teks">{judul}</h2>
        {keterangan && <p className="text-sm text-teks-2 mt-0.5">{keterangan}</p>}
      </div>
      <div className="divide-y divide-garis">{children}</div>
    </section>
  )
}

function Baris({ judul, keterangan, children }: { judul: string; keterangan: ReactNode; children: ReactNode }) {
  return (
    <div className="px-5 desktop:px-6 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-teks">{judul}</p>
        <p className="text-sm text-teks-2 mt-0.5 leading-relaxed">{keterangan}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function TabSetelan({ onHapus }: { onHapus: () => void }) {
  const { aktif, ubahFormulir } = useFormulir()
  const [durasi, setDurasi] = useState(() => String(aktif?.durasiMenit ?? 45))

  useEffect(() => { if (aktif) setDurasi(String(aktif.durasiMenit)) }, [aktif?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!aktif) return null

  const angka = Number(durasi)
  const durasiValid = Number.isInteger(angka) && angka >= 1 && angka <= 600

  return (
    <div className="max-w-192.5 mx-auto px-3 py-3 desktop:py-6 flex flex-col gap-3">
      <Bagian judul="Sesi" keterangan="Berlaku untuk sesi yang dibuka berikutnya lewat Kirim.">
        <Baris judul="Durasi pengerjaan" keterangan="Hitung mundur dimulai saat kamu menekan Mulai sesi di tab Jawaban.">
          <label className="flex items-center gap-2 text-sm text-teks-2">
            <input type="number" inputMode="numeric" min={1} max={600} value={durasi}
              onChange={e => {
                setDurasi(e.target.value)
                const n = Number(e.target.value)
                if (Number.isInteger(n) && n >= 1 && n <= 600) ubahFormulir({ durasiMenit: n })
              }}
              onWheel={e => e.currentTarget.blur()}
              className={`w-16 text-right py-1 bg-transparent text-teks outline-none border-b ${
                durasiValid ? 'border-slate-400 focus:border-b-2 focus:border-indigo-600' : 'border-b-2 border-salah'}`} />
            menit
          </label>
        </Baris>
        {/* Kalimat akibat WAJIB di samping sakelarnya: "waktunya tetap berjalan"
            ditanggung murid, dan guru harus tahu itu SEBELUM menyalakan. */}
        <Baris judul="Kunci layar murid"
          keterangan="Murid yang keluar dari layar atau membuka aplikasi lain terkunci sampai kamu membukanya. Waktunya tetap berjalan. Cocok untuk ulangan, tidak untuk latihan santai.">
          <Sakelar label="Kunci layar murid" aktif={aktif.kunciLayar} onUbah={v => ubahFormulir({ kunciLayar: v })} />
        </Baris>
      </Bagian>

      <Bagian judul="Formulir">
        <Baris judul="Hapus formulir"
          keterangan="Semua pertanyaannya ikut terhapus. Sesi yang pernah dibuka beserta nilainya tetap bisa dilihat di menu ☰ → Arsip sesi.">
          <Button variant="teks" onClick={onHapus} className="text-salah! hover:bg-red-50!">Hapus</Button>
        </Baris>
      </Bagian>
    </div>
  )
}
