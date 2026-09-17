import { useState } from 'react'
import type { SesiKelas } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { masalahSoal } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { BagikanSesi } from '../../components/BagikanSesi'

// ─── Kirim = buka sesi dari formulir ─────────────────────────────────────────
// Pemeriksaan kelengkapan dilakukan DUA kali dengan aturan yang sama: di sini
// supaya guru langsung diantar ke soal yang bermasalah, dan di server
// (buka_sesi_formulir) sebagai penentu.

export function DialogKirim({ onTutup, onPerbaiki, onSetelan, onJawaban }: {
  onTutup: () => void
  onPerbaiki: (soalId: string) => void
  onSetelan: () => void
  onJawaban: () => void
}) {
  const { aktif, soal, simpanSekarang } = useFormulir()
  const { semuaSesi, bukaSesi } = useSesi()
  const [membuka, setMembuka] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sesiBaru, setSesiBaru] = useState<SesiKelas | null>(null)

  if (!aktif) return null

  const bermasalah = soal.map((s, i) => ({ s, i, masalah: masalahSoal(s) })).filter(x => x.masalah)
  const berjalan = semuaSesi.filter(s => s.formulirId === aktif.id && s.status === 'aktif')

  async function buka() {
    setMembuka(true); setGalat(null)
    // Ketikan terakhir guru bisa masih tertahan debounce -- sesi harus memuat
    // soal yang TERLIHAT di layar, bukan versi 600 ms yang lalu.
    if (!await simpanSekarang()) {
      setGalat('Ada perubahan yang belum tersimpan. Periksa koneksi, lalu coba lagi.')
      setMembuka(false)
      return
    }
    try {
      setSesiBaru(await bukaSesi(aktif!.id))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuka sesi. Coba lagi.')
    } finally {
      setMembuka(false)
    }
  }

  if (sesiBaru) {
    return (
      <Dialog judul="Sesi dibuka" onTutup={onTutup} lebar="max-w-lg"
        aksi={<>
          <Button variant="teks" onClick={onTutup}>Tutup</Button>
          <Button onClick={onJawaban}>Pantau di Jawaban</Button>
        </>}>
        <p className="mb-4">
          Murid bergabung lewat QR, link, atau kode — tanpa akun. Tekan <strong className="font-medium text-teks">Mulai
          sesi</strong> di tab Jawaban setelah semua masuk.
        </p>
        <BagikanSesi kode={sesiBaru.kodeJoin} qrSebaris />
      </Dialog>
    )
  }

  // Server menyebut nomor soal; nomor itu diterjemahkan balik ke kartunya.
  const nomorGalat = galat?.match(/^Soal nomor (\d+)/)?.[1]
  const soalGalat = nomorGalat ? soal[Number(nomorGalat) - 1] : undefined

  if (soal.length === 0) {
    return (
      <Dialog judul="Kirim formulir" onTutup={onTutup} aksi={<Button variant="teks" onClick={onTutup}>Tutup</Button>}>
        Formulir ini belum punya pertanyaan. Tambahkan atau impor pertanyaan dulu.
      </Dialog>
    )
  }

  if (bermasalah.length > 0) {
    return (
      <Dialog judul="Belum bisa dikirim" onTutup={onTutup}
        aksi={<>
          <Button variant="teks" onClick={onTutup}>Tutup</Button>
          <Button variant="teks" onClick={() => onPerbaiki(bermasalah[0].s.id)}>Perbaiki</Button>
        </>}>
        <p>{bermasalah.length} pertanyaan belum lengkap:</p>
        <ul className="mt-2 flex flex-col gap-1">
          {bermasalah.slice(0, 5).map(({ s, i, masalah }) => (
            <li key={s.id} className="flex gap-2 text-teks">
              <Ikon nama="galat" className="w-4 h-4 mt-0.5 text-salah" />
              <span className="min-w-0 break-words">
                Pertanyaan {i + 1}{s.pertanyaan.trim() && <span className="text-teks-2"> ({s.pertanyaan.trim().slice(0, 40)}{s.pertanyaan.trim().length > 40 ? '…' : ''})</span>}: {masalah}
              </span>
            </li>
          ))}
          {bermasalah.length > 5 && <li className="text-teks-2">dan {bermasalah.length - 5} lainnya</li>}
        </ul>
      </Dialog>
    )
  }

  return (
    <Dialog judul="Kirim formulir" onTutup={membuka ? undefined : onTutup}
      aksi={<>
        <Button variant="teks" onClick={onTutup} disabled={membuka}>Batal</Button>
        {soalGalat
          ? <Button variant="teks" onClick={() => onPerbaiki(soalGalat.id)}>Perbaiki</Button>
          : <Button onClick={() => void buka()} disabled={membuka}>{membuka ? 'Membuka…' : 'Buka sesi'}</Button>}
      </>}>
      <p>Kirim membuka <strong className="font-medium text-teks">sesi</strong> baru dengan kode sendiri. Soal disalin saat ini juga — mengedit formulir sesudahnya tidak mengubah sesi itu.</p>
      <ul className="mt-4 flex flex-col gap-2.5 text-teks">
        <li className="flex items-center gap-3"><Ikon nama="dokumen" className="w-5 h-5 text-teks-2" />{soal.length} pertanyaan</li>
        <li className="flex items-center gap-3"><Ikon nama="awan" className="w-5 h-5 text-teks-2" />{aktif.durasiMenit} menit pengerjaan</li>
        <li className="flex items-center gap-3"><Ikon nama="kunci" className="w-5 h-5 text-teks-2" />Kunci layar {aktif.kunciLayar ? 'menyala' : 'mati'}</li>
      </ul>
      <button type="button" onClick={onSetelan} className="mt-2 -ml-2 px-2 py-1.5 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50">
        Ubah setelan
      </button>
      {berjalan.length > 0 && (
        <p className="mt-3 text-sm">Sesi <strong className="font-mono font-medium text-teks">{berjalan.map(s => s.kodeJoin).join(', ')}</strong> masih dibuka. Sesi baru tidak menutupnya.</p>
      )}
      {galat && <p className="mt-3 text-sm text-salah">{galat}</p>}
    </Dialog>
  )
}
