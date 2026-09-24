import { useEffect, useState } from 'react'
import { useKembali } from '../../context/NavContext'
import { useFormulir, type StatusSimpan } from '../../context/FormulirContext'
import { Ikon, TombolIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Dialog } from '../../components/ui/Dialog'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { TabPertanyaan, type PermintaanSorot } from './TabPertanyaan'
import { DialogKirim } from './DialogKirim'
import { Pratinjau } from './Pratinjau'
import { unduhFormulirDocx } from '../../lib/unduhFormulir'

// ─── Editor satu formulir, layar penuh ───────────────────────────────────────
// Dibuka dari tab Soal dan menumpuk di atas bilah tab. Isinya cuma satu layar
// (Pertanyaan) -- tab "Setelan" (durasi, kunci layar, hapus) dibuang
// 2026-09-22: durasi & kunci layar pindah ke layar Sesi (setelan MILIK sesi,
// bukan formulir -- lihat SesiPage.tsx), dan "Hapus formulir" pindah ke menu
// titik-tiga di header di bawah.
//
// Tab "Jawaban" yang dulu ada di sini SENGAJA tidak ikut: jawaban datang per
// SESI, bukan per formulir, dan sekarang punya tempatnya sendiri di tab Sesi.
// Menekan Kirim mengantar guru ke sana lewat onPantauSesi.
//
// Simpan MANUAL (2026-09-23): FormulirContext tidak lagi menulis apa pun sendiri
// -- IndikatorSimpan di bawah jadi tombol Simpan begitu ada perubahan, dan
// keluar (panah kembali / tombol kembali perangkat) dengan perubahan yang
// belum ditulis memunculkan `konfirmasiKeluar` alih-alih langsung menutup.

function Penjaga({ tangani }: { tangani: () => boolean }) {
  useKembali(tangani)
  return null
}

export function EditorFormulir({ onKeluar, onPantauSesi, onImpor, onTerhapus }: {
  onKeluar: () => void
  /** Sesi baru sudah dibuka: tutup editor, buka panel sesinya. */
  onPantauSesi: (sesiId: string) => void
  onImpor: () => void
  onTerhapus: () => void
}) {
  const { memuat, aktif, soal, statusSimpan, galatSimpan, punyaPerubahan, simpanSekarang, batalkanPerubahan, hapusFormulir } = useFormulir()
  const [kirim, setKirim] = useState(false)
  const [pratinjau, setPratinjau] = useState(false)
  const [menu, setMenu] = useState(false)
  const [hapus, setHapus] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galatHapus, setGalatHapus] = useState<string | null>(null)
  const [konfirmasiKeluar, setKonfirmasiKeluar] = useState(false)
  const [menyimpanKeluar, setMenyimpanKeluar] = useState(false)
  const [galatKeluar, setGalatKeluar] = useState<string | null>(null)
  const [sorot, setSorot] = useState<PermintaanSorot | null>(null)

  function jalankanUnduh() {
    if (!aktif) return
    setMenu(false)
    void unduhFormulirDocx(aktif, soal).catch(e => console.error('[unduh]', e instanceof Error ? e.message : e))
  }

  async function jalankanHapus() {
    if (!aktif) return
    setSibuk(true); setGalatHapus(null)
    try {
      await hapusFormulir(aktif.id)
      onTerhapus()
    } catch (e) {
      setGalatHapus(e instanceof Error ? e.message : 'Gagal menghapus, coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  // Tombol kembali & panah header sama-sama lewat sini: ada perubahan belum
  // tersimpan -> tanya dulu, alih-alih diam-diam membuangnya.
  function mintaKeluar() {
    if (punyaPerubahan) { setGalatKeluar(null); setKonfirmasiKeluar(true) }
    else onKeluar()
  }

  async function simpanLaluKeluar() {
    setMenyimpanKeluar(true); setGalatKeluar(null)
    const berhasil = await simpanSekarang()
    setMenyimpanKeluar(false)
    if (berhasil) { setKonfirmasiKeluar(false); onKeluar() }
    else setGalatKeluar(galatSimpan ?? 'Gagal menyimpan. Periksa koneksi, lalu coba lagi.')
  }

  function buangLaluKeluar() {
    batalkanPerubahan()
    setKonfirmasiKeluar(false)
    onKeluar()
  }

  // Tab ditutup/direfresh lewat browser (bukan tombol kembali dalam aplikasi)
  // -- lihat juga guard yang sama di FormulirContext untuk beforeunload window.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!punyaPerubahan) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [punyaPerubahan])

  if (memuat && !aktif) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 text-indigo-500">
        <Spinner size={28} />
      </div>
    )
  }
  if (!aktif) return null

  return (
    <div className="h-full flex flex-col bg-slate-50 tekstur-latar halaman-masuk">
      {/* Anak PERTAMA = diperiksa paling akhir: keluar dari editor kalau tidak
          ada lapisan lain yang menangani lebih dulu. */}
      <Penjaga tangani={() => { mintaKeluar(); return true }} />

      <header className="shrink-0 bg-white border-b border-slate-100 shadow-sm relative">
        <div className="h-12 pl-1 pr-2 flex items-center gap-1 desktop:max-w-2xl desktop:w-full desktop:mx-auto">
          <button type="button" aria-label="Kembali ke daftar formulir" onClick={mintaKeluar}
            className="min-w-11 h-11 px-2 flex items-center justify-center rounded-xl active:bg-slate-100 transition-colors">
            <Ikon nama="kembali" className="w-5 h-5 text-slate-600" tebal={2} />
          </button>
          <p className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-700">
            {aktif.judul.trim() || 'Formulir tanpa judul'}
          </p>
          <IndikatorSimpan status={statusSimpan} galatSimpan={galatSimpan} punyaPerubahan={punyaPerubahan}
            onSimpan={() => void simpanSekarang()} />
          <TombolIkon nama="lihat" label="Pratinjau" onClick={() => setPratinjau(true)} className="w-9 h-9" />
          <TombolIkon nama="lainnya" label="Menu lainnya" onClick={() => setMenu(v => !v)} className="w-9 h-9" />
          <Button size="sm" onClick={() => setKirim(true)} className="ml-0.5">
            <Ikon nama="kirim" className="w-4 h-4" />Kirim
          </Button>
        </div>

        {menu && (
          <>
            {/* Overlay tak kasat mata -- menutup menu begitu diketuk di luar. */}
            <button type="button" aria-label="Tutup menu" onClick={() => setMenu(false)}
              className="fixed inset-0 z-10 cursor-default" />
            <div className="absolute right-2 top-12 z-20 w-48 bg-white rounded-2xl border border-slate-100 shadow-lg py-1.5 desktop:right-[calc((100%-42rem)/2+0.5rem)]">
              <button type="button" onClick={jalankanUnduh}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Ikon nama="dokumen" className="w-4.5 h-4.5" />Unduh (.docx)
              </button>
              <button type="button"
                onClick={() => { setMenu(false); setGalatHapus(null); setHapus(true) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                <Ikon nama="hapus" className="w-4.5 h-4.5" />Hapus formulir
              </button>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
        <TabPertanyaan sorot={sorot} onImpor={onImpor} />
      </main>

      {kirim && (
        <DialogKirim
          onTutup={() => setKirim(false)}
          onPerbaiki={id => { setKirim(false); setSorot({ soalId: id, kali: Date.now() }) }}
          onPantauSesi={id => { setKirim(false); onPantauSesi(id) }}
        />
      )}

      {pratinjau && <Pratinjau onTutup={() => setPratinjau(false)} />}

      {hapus && (
        <LembarKonfirmasi
          judul="Hapus formulir ini?"
          pesan={<>
            “{aktif.judul.trim() || 'Formulir tanpa judul'}” dan {soal.length} pertanyaannya dihapus.
            Sesi yang pernah dibuka beserta nilainya tetap ada di tab Sesi.
            {galatHapus && <span className="block mt-2 text-red-600">{galatHapus}</span>}
          </>}
          labelAksi="Hapus"
          sibuk={sibuk}
          onAksi={() => void jalankanHapus()}
          onBatal={() => setHapus(false)}
        />
      )}

      {konfirmasiKeluar && (
        <Dialog judul="Ada perubahan belum disimpan" onTutup={menyimpanKeluar ? undefined : () => setKonfirmasiKeluar(false)}
          tombolTutup
          aksi={<>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={buangLaluKeluar} disabled={menyimpanKeluar}>
              Buang & keluar
            </Button>
            <Button onClick={() => void simpanLaluKeluar()} disabled={menyimpanKeluar}>
              {menyimpanKeluar ? 'Menyimpan…' : 'Simpan & keluar'}
            </Button>
          </>}>
          Soal atau judul yang baru kamu ubah belum tersimpan. Simpan dulu, atau keluar dan buang perubahannya.
          {galatKeluar && <p className="mt-2 text-sm text-red-600">{galatKeluar}</p>}
        </Dialog>
      )}

      {/* Anak TERAKHIR = diperiksa lebih dulu dari penjaga "keluar" di atas. */}
      <Penjaga tangani={() => {
        if (konfirmasiKeluar) { if (!menyimpanKeluar) setKonfirmasiKeluar(false); return true }
        if (hapus) { if (!sibuk) setHapus(false); return true }
        if (pratinjau) { setPratinjau(false); return true }
        if (kirim) { setKirim(false); return true }
        if (menu) { setMenu(false); return true }
        return false
      }} />
    </div>
  )
}

function IndikatorSimpan({ status, galatSimpan, punyaPerubahan, onSimpan }: {
  status: StatusSimpan
  galatSimpan: string | null
  punyaPerubahan: boolean
  onSimpan: () => void
}) {
  if (status === 'gagal') {
    return (
      <button type="button" onClick={onSimpan} title={`${galatSimpan ?? 'Gagal menyimpan'} (ketuk untuk mencoba lagi)`}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50">
        <Ikon nama="galat" className="w-4.5 h-4.5" />
        <span className="hidden sm:inline">{galatSimpan ?? 'Gagal · Coba lagi'}</span>
      </button>
    )
  }
  if (status === 'menyimpan') {
    return (
      <span title="Menyimpan…" className="flex items-center gap-1.5 h-9 px-2.5 text-xs font-medium text-slate-400">
        <Spinner size={15} />
        <span className="hidden sm:inline">Menyimpan…</span>
      </span>
    )
  }
  if (punyaPerubahan) {
    return (
      <button type="button" onClick={onSimpan}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
        <Ikon nama="awan" className="w-4 h-4" />Simpan
      </button>
    )
  }
  return (
    <span title="Semua perubahan tersimpan" className="flex items-center gap-1.5 px-2 text-xs font-medium text-slate-400">
      <Ikon nama="awanSelesai" className="w-4.5 h-4.5" />
      <span className="hidden sm:inline">Tersimpan</span>
    </span>
  )
}
