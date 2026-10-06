import { useState } from 'react'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function DialogBuatSuperSesi({ onTutup, onDibuat }: {
  onTutup: () => void
  onDibuat: (id: string) => void
}) {
  const { buatSuperSesi } = useSuperSesi()
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function buat() {
    setSibuk(true); setGalat(null)
    try {
      const id = await buatSuperSesi(judul.trim() || 'Super Sesi tanpa judul', deskripsi.trim())
      onDibuat(id)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat Super Sesi. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Dialog judul="Buat Super Sesi" onTutup={sibuk ? undefined : onTutup} lebar="max-w-md lg:max-w-160"
      aksi={<>
        <Button variant="ghost" onClick={onTutup} disabled={sibuk}>Batal</Button>
        <Button onClick={() => void buat()} disabled={sibuk}>{sibuk ? 'Membuat…' : 'Buat'}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <p>Guru mapel akan bisa mengirim formulir soal ke sini selama statusnya masih mengumpulkan.</p>
        <Input label="Judul" placeholder="mis. UAS Semester Ganjil 2026/2027" value={judul}
          onChange={e => setJudul(e.target.value)} autoFocus />
        <Input label="Keterangan (opsional)" placeholder="mis. Kelas 7-9, 25 November 2026" value={deskripsi}
          onChange={e => setDeskripsi(e.target.value)} />
        {/* Desktop: alur lengkapnya dikatakan sebelum dibuat -- siapa mengerjakan apa. */}
        <div className="hidden lg:block rounded-2xl bg-isian border border-garis-2 px-4.5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 mb-3">Setelah dibuat</p>
          <ol className="flex flex-col gap-3">
            {[
              'Guru mapel mengirim formulir soal ke Super Sesi ini lewat tombol Kirim.',
              <>Kamu menekan <strong className="text-tinta">Mulai Super Sesi</strong> setelah semua kiriman masuk.</>,
              'Guru mana pun di sekolahmu mengambil kelasnya dan mengawas. Kamu memantau semuanya dari sini.',
            ].map((langkah, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-tinta text-white flex items-center justify-center text-[12.5px] font-extrabold shrink-0">{i + 1}</span>
                <span className="text-sm leading-snug text-tinta-2">{langkah}</span>
              </li>
            ))}
          </ol>
        </div>
        {galat && <p className="text-sm text-jingga-gelap">{galat}</p>}
      </div>
    </Dialog>
  )
}
