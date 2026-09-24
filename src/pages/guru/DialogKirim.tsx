import { useEffect, useState } from 'react'
import type { SesiKelas, SuperSesiRingkas } from '../../types'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { supabase } from '../../lib/supabase'
import { masalahSoal, masalahFormulir } from '../../lib/soal'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Ikon, type NamaIkon } from '../../components/ui/Ikon'
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

function BarisRingkas({ ikon, teks }: { ikon: NamaIkon; teks: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      <Ikon nama={ikon} className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
      <span className="text-sm text-slate-700">{teks}</span>
    </li>
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
          <strong className="font-semibold text-slate-700">Mulai sesi</strong> setelah semua masuk.
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
          Soal terkirim ke <strong className="font-semibold text-slate-700">{superSesiTerkirim.judul}</strong>.
          Menunggu kepala sekolah menugaskan pengawas dan memulai.
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
            <li key={s.id} className="flex gap-2 rounded-xl bg-red-50 px-3 py-2">
              <Ikon nama="galat" className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
              <span className="min-w-0 break-words text-xs text-slate-700">
                Pertanyaan {i + 1}
                {s.pertanyaan.trim() && (
                  <span className="text-slate-400"> ({s.pertanyaan.trim().slice(0, 40)}{s.pertanyaan.trim().length > 40 ? '…' : ''})</span>
                )}: {masalah}
              </span>
            </li>
          ))}
          {bermasalah.length > 5 && <li className="text-xs text-slate-400 px-1">dan {bermasalah.length - 5} lainnya</li>}
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
  // kepala sekolah, lihat CLAUDE.md) berdiri sejajar sebagai dua kartu.
  return (
    <Dialog judul="Kirim formulir" onTutup={sibuk ? undefined : onTutup} lebar="max-w-lg"
      aksi={<Button variant="ghost" onClick={onTutup} disabled={sibuk}>Batal</Button>}>
      <p>
        Soal disalin saat ini juga, jadi mengedit formulir sesudahnya tidak mengubah
        sesi/kiriman yang sudah dibuat.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        <BarisRingkas ikon="soal" teks={`${soal.length} pertanyaan`} />
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        <button type="button" disabled={sibuk} onClick={() => void buka()}
          className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50 transition-colors disabled:opacity-60">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Ikon nama="sesi" className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-700">Sesi Mandiri</span>
            <span className="block text-xs text-slate-400 mt-0.5">Buka & kelola sendiri, cocok untuk ulangan harian</span>
          </span>
          {membuka
            ? <span className="text-xs text-indigo-400 shrink-0">Membuka…</span>
            : <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />}
        </button>

        {superSesiTerbuka.length > 0 ? (
          superSesiTerbuka.map(s => (
            <button key={s.id} type="button" disabled={sibuk} onClick={() => void kirimSuper(s)}
              className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50 transition-colors disabled:opacity-60">
              <span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <Ikon nama="perisai" className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-700">Kirim ke Super Sesi</span>
                <span className="block text-xs text-slate-400 mt-0.5 truncate">{s.judul}</span>
              </span>
              {mengirimSuper === s.id
                ? <span className="text-xs text-violet-400 shrink-0">Mengirim…</span>
                : <Ikon nama="kanan" className="w-4 h-4 text-slate-300 shrink-0" tebal={2} />}
            </button>
          ))
        ) : (
          <div className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-3">
            <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
              <Ikon nama="perisai" className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-500">Kirim ke Super Sesi</span>
              <span className="block text-xs text-slate-400 mt-0.5">Belum ada Super Sesi yang dibuka kepala sekolah</span>
            </span>
          </div>
        )}
      </div>

      {berjalan.length > 0 && (
        <p className="mt-3 text-xs">
          Sesi <strong className="font-mono font-bold text-slate-700">{berjalan.map(s => s.kodeJoin).join(', ')}</strong> masih
          dibuka. Sesi baru tidak menutupnya.
        </p>
      )}
      {galat && <p className="mt-3 text-sm text-red-600">{galat}</p>}
    </Dialog>
  )
}
