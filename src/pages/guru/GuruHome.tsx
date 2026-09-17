import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useKembali } from '../../context/NavContext'
import { useFormulir, type StatusSimpan } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { Ikon, TombolIkon, type NamaIkon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { TabPertanyaan, type PermintaanSorot } from './TabPertanyaan'
import { TabJawaban } from './TabJawaban'
import { TabSetelan } from './TabSetelan'
import { DialogKirim } from './DialogKirim'
import { DialogImpor } from './DialogImpor'
import { Laci } from './Laci'
import { Pratinjau } from './Pratinjau'

// ─── Halaman guru: SATU halaman editor ala Google Form ───────────────────────
// Kepala: ☰ · judul formulir · status simpan · pratinjau · Kirim, lalu tab
// Pertanyaan · Jawaban · Setelan. Semua yang lain (formulir lain, impor, arsip,
// akun) ada di laci ☰ atau dialog, bukan halaman terpisah.
// test //

type Tab = 'pertanyaan' | 'jawaban' | 'setelan'

const TAB: { id: Tab; label: string }[] = [
  { id: 'pertanyaan', label: 'Pertanyaan' },
  { id: 'jawaban', label: 'Jawaban' },
  { id: 'setelan', label: 'Setelan' },
]

/**
 * Penangan tombol kembali perangkat. Penangan diperiksa dari yang TERAKHIR
 * ter-mount, jadi posisinya di pohon menentukan prioritasnya -- lihat pemakaian.
 */
function Penjaga({ tangani }: { tangani: () => boolean }) {
  useKembali(tangani)
  return null
}

export function GuruHome() {
  const { user, logout } = useAuth()
  const { memuat, aktif, soal, statusSimpan, cobaSimpanLagi, buatFormulir, hapusFormulir, simpanSekarang } = useFormulir()
  const { semuaSesi } = useSesi()
  const [tab, setTab] = useState<Tab>('pertanyaan')
  const [laci, setLaci] = useState(false)
  const [arsip, setArsip] = useState(false)
  const [kirim, setKirim] = useState(false)
  const [impor, setImpor] = useState<'baru' | 'ini' | null>(null)
  const [pratinjau, setPratinjau] = useState(false)
  const [konfirmasi, setKonfirmasi] = useState<'hapus' | 'keluar' | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [galatKonfirmasi, setGalatKonfirmasi] = useState<string | null>(null)
  const [membuat, setMembuat] = useState(false)
  const [sorot, setSorot] = useState<PermintaanSorot | null>(null)
  const [kabar, setKabar] = useState<string | null>(null)

  // Pindah formulir = mulai dari tab Pertanyaan, seperti membuka formulir lain.
  useEffect(() => { setTab('pertanyaan'); setSorot(null) }, [aktif?.id])

  useEffect(() => {
    if (!kabar) return
    const t = setTimeout(() => setKabar(null), 4000)
    return () => clearTimeout(t)
  }, [kabar])

  const sesiFormulir = useMemo(() => aktif ? semuaSesi.filter(s => s.formulirId === aktif.id) : [], [semuaSesi, aktif])
  const sesiArsip = useMemo(() => semuaSesi.filter(s => !s.formulirId), [semuaSesi])
  const pesertaBerjalan = sesiFormulir.filter(s => s.status === 'aktif').reduce((n, s) => n + s.muridJoined.length, 0)

  async function formulirBaru() {
    if (membuat) return
    setMembuat(true)
    try {
      await buatFormulir()
      setLaci(false)
      setArsip(false)
    } catch {
      setKabar('Gagal membuat formulir. Coba lagi.')
    } finally {
      setMembuat(false)
    }
  }

  async function jalankanKonfirmasi() {
    setSibuk(true); setGalatKonfirmasi(null)
    try {
      if (konfirmasi === 'hapus' && aktif) {
        await hapusFormulir(aktif.id)
      } else if (konfirmasi === 'keluar') {
        await simpanSekarang()
        await logout()
      }
      setKonfirmasi(null)
    } catch (e) {
      setGalatKonfirmasi(e instanceof Error ? e.message : 'Gagal, coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  const judulKepala = arsip ? 'Arsip sesi' : aktif ? (aktif.judul.trim() || 'Formulir tanpa judul') : NAMA_APLIKASI

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Anak PERTAMA = diperiksa paling akhir: tab & arsip baru ditutup setelah
          semua lapisan di atasnya. */}
      <Penjaga tangani={() => {
        if (arsip) { setArsip(false); return true }
        if (aktif && tab !== 'pertanyaan') { setTab('pertanyaan'); return true }
        return false
      }} />

      <header className="shrink-0 bg-white border-b border-garis">
        <div className="h-14 pl-1 pr-2 flex items-center gap-1">
          <TombolIkon nama="menu" label="Menu" onClick={() => setLaci(true)} />
          {!arsip && <Ikon nama="dokumen" className="w-7 h-7 text-indigo-600 hidden sm:block" />}
          <p className="flex-1 min-w-0 truncate text-lg text-teks px-1">{judulKepala}</p>
          {arsip ? (
            <TombolIkon nama="tutup" label="Tutup arsip" onClick={() => setArsip(false)} />
          ) : aktif && (
            <>
              <IndikatorSimpan status={statusSimpan} onCobaLagi={cobaSimpanLagi} />
              <TombolIkon nama="lihat" label="Pratinjau" onClick={() => setPratinjau(true)} />
              <Button onClick={() => setKirim(true)} className="ml-1 px-5!">Kirim</Button>
            </>
          )}
        </div>
        {aktif && !arsip && (
          <nav className="flex justify-center gap-1 desktop:gap-4">
            {TAB.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`relative h-11 px-3 desktop:px-4 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  tab === t.id ? 'text-indigo-600' : 'text-teks-2 hover:text-teks'}`}>
                {t.label}
                {t.id === 'jawaban' && pesertaBerjalan > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] leading-5 text-center">{pesertaBerjalan}</span>
                )}
                {tab === t.id && <span className="absolute left-1 right-1 bottom-0 h-0.75 rounded-t bg-indigo-600" />}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {arsip ? (
          <TabJawaban sesiList={sesiArsip} kosong={<p className="text-sm text-teks-2">Arsip kosong.</p>} />
        ) : memuat && !aktif ? (
          <div className="py-20 flex justify-center text-indigo-600"><Spinner size={28} /></div>
        ) : !aktif ? (
          <Sambutan nama={user?.nama ?? ''} membuat={membuat} onBaru={() => void formulirBaru()} onImpor={() => setImpor('baru')} />
        ) : tab === 'pertanyaan' ? (
          <TabPertanyaan sorot={sorot} onImpor={() => setImpor('ini')} />
        ) : tab === 'jawaban' ? (
          <TabJawaban sesiList={sesiFormulir} kosong={<>
            <Ikon nama="kirim" className="w-12 h-12 text-indigo-200" />
            <p className="text-base text-teks">Belum ada jawaban</p>
            <p className="text-sm text-teks-2 max-w-sm">Tekan Kirim untuk membuka sesi. Murid bergabung dengan kode, QR, atau link — tanpa akun.</p>
            <Button onClick={() => setKirim(true)} className="mt-1">Kirim</Button>
          </>} />
        ) : (
          <TabSetelan onHapus={() => { setGalatKonfirmasi(null); setKonfirmasi('hapus') }} />
        )}
      </main>

      {laci && (
        <Laci
          membuat={membuat}
          onTutup={() => setLaci(false)}
          onBaru={() => void formulirBaru()}
          onImpor={() => { setLaci(false); setImpor('baru') }}
          onArsip={() => { setLaci(false); setArsip(true) }}
          onKeluar={() => { setLaci(false); setGalatKonfirmasi(null); setKonfirmasi('keluar') }}
        />
      )}

      {kirim && (
        <DialogKirim
          onTutup={() => setKirim(false)}
          onPerbaiki={id => { setKirim(false); setTab('pertanyaan'); setSorot({ soalId: id, kali: Date.now() }) }}
          onSetelan={() => { setKirim(false); setTab('setelan') }}
          onJawaban={() => { setKirim(false); setTab('jawaban') }}
        />
      )}

      {impor && (
        <DialogImpor
          tujuan={impor}
          onTutup={() => setImpor(null)}
          onSelesai={n => { setImpor(null); setArsip(false); setTab('pertanyaan'); setKabar(`${n} pertanyaan diimpor`) }}
        />
      )}

      {pratinjau && <Pratinjau onTutup={() => setPratinjau(false)} />}

      {konfirmasi && (
        <LembarKonfirmasi
          judul={konfirmasi === 'hapus' ? 'Hapus formulir ini?' : 'Keluar dari akun?'}
          pesan={<>
            {konfirmasi === 'hapus'
              ? `“${aktif?.judul.trim() || 'Formulir tanpa judul'}” dan ${soal.length} pertanyaannya dihapus. Sesi yang pernah dibuka beserta nilainya pindah ke Arsip sesi.`
              : 'Formulirmu tersimpan di akun. Masuk lagi dengan email dan password untuk melanjutkan.'}
            {galatKonfirmasi && <span className="block mt-2 text-salah">{galatKonfirmasi}</span>}
          </>}
          labelAksi={konfirmasi === 'hapus' ? 'Hapus' : 'Keluar'}
          sibuk={sibuk}
          onAksi={() => void jalankanKonfirmasi()}
          onBatal={() => setKonfirmasi(null)}
        />
      )}

      {kabar && (
        <div className="fixed left-4 bottom-4 z-40 rounded bg-[#323232] px-4 py-3 text-sm text-white shadow-lg">{kabar}</div>
      )}

      {/* Anak TERAKHIR = diperiksa lebih dulu dari penjaga tab: lapisan yang
          menutupi halaman ditutup satu per satu dari yang paling atas. */}
      <Penjaga tangani={() => {
        if (konfirmasi) { if (!sibuk) setKonfirmasi(null); return true }
        if (pratinjau) { setPratinjau(false); return true }
        if (impor) { setImpor(null); return true }
        if (kirim) { setKirim(false); return true }
        if (laci) { setLaci(false); return true }
        return false
      }} />
    </div>
  )
}

function IndikatorSimpan({ status, onCobaLagi }: { status: StatusSimpan; onCobaLagi: () => void }) {
  if (status === 'gagal') {
    return (
      <button type="button" onClick={onCobaLagi} title="Gagal menyimpan — ketuk untuk mencoba lagi"
        className="flex items-center gap-1.5 h-9 px-2 rounded-md text-sm text-salah hover:bg-red-50">
        <Ikon nama="galat" className="w-5 h-5" />
        <span className="hidden sm:inline">Gagal menyimpan · Coba lagi</span>
      </button>
    )
  }
  const menyimpan = status === 'menyimpan'
  return (
    <span title={menyimpan ? 'Menyimpan…' : 'Semua perubahan disimpan'} className="flex items-center gap-1.5 px-2 text-sm text-teks-2">
      <Ikon nama={menyimpan ? 'awan' : 'awanSelesai'} className={`w-5 h-5 ${menyimpan ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline">{menyimpan ? 'Menyimpan…' : 'Tersimpan'}</span>
    </span>
  )
}

function Sambutan({ nama, membuat, onBaru, onImpor }: {
  nama: string
  membuat: boolean
  onBaru: () => void
  onImpor: () => void
}) {
  const pilihan: { ikon: NamaIkon; judul: string; onClick: () => void }[] = [
    { ikon: 'tambah', judul: membuat ? 'Membuat…' : 'Formulir kosong', onClick: onBaru },
    { ikon: 'impor', judul: 'Impor dari Google Form', onClick: onImpor },
  ]
  return (
    <div className="max-w-192.5 mx-auto px-3 py-6 desktop:py-10 flex flex-col gap-4">
      <Card accent>
        <h1 className="text-[28px] leading-tight text-teks">Halo{nama && `, ${nama}`}</h1>
        <p className="text-sm text-teks-2 mt-2 leading-relaxed">
          Tulis soal pilihan ganda di sini atau ambil dari Google Form, lalu tekan Kirim untuk membuka sesi.
          Murid bergabung dengan kode — tanpa akun.
        </p>
      </Card>
      <p className="text-sm font-medium text-teks px-1 mt-2">Mulai formulir baru</p>
      <div className="grid grid-cols-2 gap-3">
        {pilihan.map(p => (
          <button key={p.ikon} type="button" onClick={p.onClick} disabled={membuat && p.ikon === 'tambah'}
            className="bg-white rounded-lg border border-garis hover:border-indigo-600 transition-colors h-36 flex flex-col items-center justify-center gap-3 p-4 text-center disabled:opacity-60">
            <Ikon nama={p.ikon} className="w-12 h-12 text-indigo-600" />
            <span className="text-sm text-teks">{p.judul}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
