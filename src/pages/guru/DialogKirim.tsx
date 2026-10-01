import { useEffect, useState } from 'react'
import type { SesiKelas, SuperSesiRingkas } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { supabase } from '../../lib/supabase'
import { masalahSoal, masalahFormulir } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { BagikanSesi } from '../../components/BagikanSesi'

// ─── Kirim = buka sesi dari formulir ─────────────────────────────────────────
// Pemeriksaan kelengkapan SOAL dilakukan DUA kali dengan aturan yang sama: di
// sini supaya guru langsung diantar ke soal yang bermasalah, dan di server
// (buka_sesi_formulir) sebagai penentu.
//
// masalahFormulir() (judul/kelas/mapel) beda -- itu SUDAH ditegakkan lebih
// awal oleh simpanSekarang() (FormulirContext, 2026-09-23), jadi begitu
// buka() jalan di sini formulirnya sudah pasti lengkap. Pengecekan di bawah
// cuma supaya guru yang belum sempat mengisi tidak melihat "Gagal menyimpan"
// generik -- tidak ada mitra server untuk aturan ini (murni kelengkapan data,
// bukan batas keamanan seperti kunci jawaban).

/** Ringkasan di atas pilihan: soal sudah lengkap & berkunci (lolos masalahSoal). */
function CatatanLengkap({ jumlah }: { jumlah: number }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-hijau-tint px-3 py-2.5 text-[13px] font-semibold text-hijau-teks">
      <Ikon nama="centang" className="w-4 h-4 shrink-0" tebal={2.6} />
      {jumlah} soal lengkap, semua punya kunci jawaban
    </p>
  )
}

export function DialogKirim({ onTutup, onPerbaiki, onPantauSesi }: {
  onTutup: () => void
  onPerbaiki: (soalId: string) => void
  /** Sesi sudah lahir: tutup editor dan buka panelnya di tab Sesi. */
  onPantauSesi: (sesiId: string) => void
}) {
  const { aktif, soal, simpanSekarang } = useFormulir()
  const { semuaSesi, bukaSesi } = useSesi()
  const [membuka, setMembuka] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [sesiBaru, setSesiBaru] = useState<SesiKelas | null>(null)
  // Super Sesi (ulangan lintas guru, dikelola kepala sekolah): daftar tujuan
  // kirim yang MASIH mengumpulkan, di sekolah guru ini sendiri -- RLS
  // (super_sesi_guru_lihat_terbuka) yang menyaringnya, bukan filter di sini.
  // Kosong = tidak ada kepala sekolah yang membuka Super Sesi -- opsi ini
  // hilang sama sekali dari dialog, alur "Buka sesi" lama tidak berubah.
  const [superSesiTerbuka, setSuperSesiTerbuka] = useState<SuperSesiRingkas[]>([])
  const [mengirimSuper, setMengirimSuper] = useState<string | null>(null)
  const [superSesiTerkirim, setSuperSesiTerkirim] = useState<{ judul: string } | null>(null)

  useEffect(() => {
    let batal = false
    void supabase.from('super_sesi').select('id, judul, deskripsi')
      .eq('status', 'mengumpulkan').order('created_at', { ascending: false })
      .then(({ data }) => { if (!batal) setSuperSesiTerbuka((data ?? []) as SuperSesiRingkas[]) })
    return () => { batal = true }
  }, [])

  if (!aktif) return null

  const bermasalah = soal.map((s, i) => ({ s, i, masalah: masalahSoal(s) })).filter(x => x.masalah)
  const berjalan = semuaSesi.filter(s => s.formulirId === aktif.id && s.status === 'aktif')

  async function kirimSuper(tujuan: SuperSesiRingkas) {
    setMengirimSuper(tujuan.id); setGalat(null)
    if (!await simpanSekarang()) {
      setGalat('Ada perubahan yang belum tersimpan. Periksa koneksi, lalu coba lagi.')
      setMengirimSuper(null)
      return
    }
    const { error } = await supabase.rpc('kirim_ke_super_sesi', { p_formulir_id: aktif!.id, p_super_sesi_id: tujuan.id })
    setMengirimSuper(null)
    if (error) { setGalat(error.message); return }
    setSuperSesiTerkirim({ judul: tujuan.judul })
  }

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
          <Button variant="ghost" onClick={onTutup}>Tutup</Button>
          <Button onClick={() => onPantauSesi(sesiBaru.id)}>Pantau sesi</Button>
        </>}>
        <p className="mb-4">
          Murid bergabung tanpa akun, lewat QR, link, atau kode. Tekan{' '}
          <strong className="font-semibold text-tinta">Mulai sesi</strong> setelah semua masuk.
        </p>
        <BagikanSesi kode={sesiBaru.kodeJoin} qrSebaris />
      </Dialog>
    )
  }

  // Beda dari sesiBaru: belum ada kode join untuk dibagikan -- soalnya baru
  // sampai ke kepala sekolah, sesinya sendiri baru lahir sesudah pengawas
  // ditugaskan dan Super Sesi dimulai (lihat SesiPage guru pengawas).
  if (superSesiTerkirim) {
    return (
      <Dialog judul="Terkirim ke Super Sesi" onTutup={onTutup} aksi={<Button onClick={onTutup}>Tutup</Button>}>
        <p>
          Soal terkirim ke <strong className="font-semibold text-tinta">{superSesiTerkirim.judul}</strong>.
          Menunggu kepala sekolah memulai Super Sesi; kelasnya lalu bisa diambil guru mana pun.
        </p>
      </Dialog>
    )
  }

  // Server menyebut nomor soal; nomor itu diterjemahkan balik ke kartunya.
  const nomorGalat = galat?.match(/^Soal nomor (\d+)/)?.[1]
  const soalGalat = nomorGalat ? soal[Number(nomorGalat) - 1] : undefined

  const masalahForm = masalahFormulir(aktif)
  if (masalahForm) {
    return (
      <Dialog judul="Belum bisa dikirim" onTutup={onTutup} aksi={<Button variant="ghost" onClick={onTutup}>Tutup</Button>}>
        {masalahForm.charAt(0).toUpperCase() + masalahForm.slice(1)}. Lengkapi judul/kelas/mapel di kartu paling atas sebelum mengirim.
      </Dialog>
    )
  }

  if (soal.length === 0) {
    return (
      <Dialog judul="Kirim formulir" onTutup={onTutup} aksi={<Button variant="ghost" onClick={onTutup}>Tutup</Button>}>
        Formulir ini belum punya pertanyaan. Tambahkan atau impor pertanyaan dulu.
      </Dialog>
    )
  }

  if (bermasalah.length > 0) {
    return (
      <Dialog judul="Belum bisa dikirim" onTutup={onTutup}
        aksi={<>
          <Button variant="ghost" onClick={onTutup}>Tutup</Button>
          <Button onClick={() => onPerbaiki(bermasalah[0].s.id)}>Perbaiki</Button>
        </>}>
        <p>{bermasalah.length} pertanyaan belum lengkap:</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {bermasalah.slice(0, 5).map(({ s, i, masalah }) => (
            <li key={s.id} className="flex gap-2 rounded-xl bg-jingga-tint px-3 py-2.5">
              <Ikon nama="galat" className="w-4 h-4 mt-0.5 text-jingga shrink-0" />
              <span className="min-w-0 break-words text-xs text-tinta">
                Pertanyaan {i + 1}
                {s.pertanyaan.trim() && (
                  <span className="text-teks-3"> ({s.pertanyaan.trim().slice(0, 40)}{s.pertanyaan.trim().length > 40 ? '…' : ''})</span>
                )}: {masalah}
              </span>
            </li>
          ))}
          {bermasalah.length > 5 && <li className="text-xs text-teks-3 px-1">dan {bermasalah.length - 5} lainnya</li>}
        </ul>
      </Dialog>
    )
  }

  // Soal sempat ditolak server pada percobaan sebelumnya (buka() ATAU
  // kirimSuper() -- keduanya memakai pesan "Soal nomor N: ..." yang sama):
  // tunjuk langsung ke situ, jangan tampilkan lagi pemilihan jenis sesi
  // sebelum itu dibetulkan.
  if (soalGalat) {
    return (
      <Dialog judul="Belum bisa dikirim" onTutup={onTutup}
        aksi={<>
          <Button variant="ghost" onClick={onTutup}>Tutup</Button>
          <Button onClick={() => onPerbaiki(soalGalat.id)}>Perbaiki</Button>
        </>}>
        {galat}
      </Dialog>
    )
  }

  const sibuk = membuka || mengirimSuper !== null

  // Langsung ke pilihan jenis sesi -- tanpa layar info perantara dengan satu
  // tombol "Buka sesi" seperti sebelumnya. Sesi Mandiri (guru sendiri yang
  // pegang kendali, cocok untuk ulangan harian) dan Super Sesi (dikirim ke
  // kepala sekolah, lihat CLAUDE.md) berdiri sebagai dua pilihan bertumpuk;
  // mengetuk salah satunya LANGSUNG menjalankannya (tidak ada tombol konfirmasi
  // terpisah), jadi keduanya berupa baris besar yang bisa ditekan.
  return (
    <Dialog judul="Kirim formulir" onTutup={sibuk ? undefined : onTutup} lebar="max-w-lg"
      aksi={<Button variant="ghost" onClick={onTutup} disabled={sibuk}>Batal</Button>}>
      <p>
        Soal disalin saat ini juga, jadi mengedit formulir sesudahnya tidak mengubah
        sesi/kiriman yang sudah dibuat.
      </p>
      <div className="mt-3"><CatatanLengkap jumlah={soal.length} /></div>

      <div className="mt-4 flex flex-col gap-2.5">
        <button type="button" disabled={sibuk} onClick={() => void buka()}
          className="w-full flex items-start gap-3 rounded-[18px] border-2 border-biru bg-biru-tipis px-4 py-3.5 text-left active:bg-biru-tint transition-colors disabled:opacity-60">
          <span className="mt-0.5 w-6.5 h-6.5 rounded-full bg-biru text-white flex items-center justify-center shrink-0">
            <Ikon nama="sesi" className="w-3.5 h-3.5" tebal={2.4} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-extrabold tracking-tight text-tinta">Sesi Mandiri</span>
            <span className="block text-[13.5px] text-tinta-2 mt-0.5 leading-snug">
              {membuka ? 'Membuka sesi…' : 'Buka dan kelola sendiri di kelasmu. Cocok untuk ulangan harian.'}
            </span>
          </span>
          <Ikon nama="kanan" className="w-4.5 h-4.5 text-biru shrink-0 mt-1" tebal={2.2} />
        </button>

        {superSesiTerbuka.length > 0 ? (
          superSesiTerbuka.map(s => (
            <button key={s.id} type="button" disabled={sibuk} onClick={() => void kirimSuper(s)}
              className="w-full flex items-start gap-3 rounded-[18px] border-[1.5px] border-garis bg-white px-4 py-3.5 text-left active:bg-isian transition-colors disabled:opacity-60">
              <span className="mt-0.5 w-6.5 h-6.5 rounded-full border-2 border-pinggir text-tinta-2 flex items-center justify-center shrink-0">
                <Ikon nama="perisai" className="w-3.5 h-3.5" tebal={2.2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-extrabold tracking-tight text-tinta">Kirim ke Super Sesi</span>
                <span className="block text-[13.5px] text-tinta-2 mt-0.5 leading-snug truncate">
                  {mengirimSuper === s.id ? 'Mengirim…' : s.judul}
                </span>
              </span>
              <Ikon nama="kanan" className="w-4.5 h-4.5 text-pinggir shrink-0 mt-1" tebal={2.2} />
            </button>
          ))
        ) : (
          <div className="w-full flex items-start gap-3 rounded-[18px] border-[1.5px] border-dashed border-pinggir-2 px-4 py-3.5">
            <span className="mt-0.5 w-6.5 h-6.5 rounded-full border-2 border-pinggir-2 text-teks-3 flex items-center justify-center shrink-0">
              <Ikon nama="perisai" className="w-3.5 h-3.5" tebal={2.2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[17px] font-extrabold tracking-tight text-teks-3">Kirim ke Super Sesi</span>
              <span className="block text-[13.5px] text-teks-3 mt-0.5 leading-snug">Belum ada Super Sesi yang dibuka kepala sekolah</span>
            </span>
          </div>
        )}
      </div>

      {berjalan.length > 0 && (
        <p className="mt-3 text-[13px]">
          Sesi <strong className="font-mono font-bold text-tinta">{berjalan.map(s => s.kodeJoin).join(', ')}</strong> masih
          dibuka. Sesi baru tidak menutupnya.
        </p>
      )}
      {galat && <p className="mt-3 text-sm font-medium text-jingga-gelap">{galat}</p>}
    </Dialog>
  )
}
