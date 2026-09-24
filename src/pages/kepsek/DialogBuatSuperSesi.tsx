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
    <Dialog judul="Buat Super Sesi" onTutup={sibuk ? undefined : onTutup}
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
        {galat && <p className="text-sm text-red-600">{galat}</p>}
      </div>
    </Dialog>
  )
}
