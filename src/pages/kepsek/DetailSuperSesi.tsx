import { useState } from 'react'
import type { SuperSesi, SubmisiSuperSesi, MuridSuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useKembali } from '../../context/NavContext'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Sakelar } from '../../components/ui/Sakelar'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'

// Kolom tabel kiriman di desktop (kartu bertumpuk di HP).
// Panel detail desktop berbagi lebar dengan daftar Super Sesi di kiri, jadi kolom
// tetapnya dijaga kecil supaya kolom Mapel tetap lega (>= 200px di layar 1440px).
const KOLOM_KIRIMAN = 'grid-cols-[minmax(0,1fr)_104px_108px_84px_68px_124px_20px]'

export function DetailSuperSesi({ superSesi, onKembali }: {
  superSesi: SuperSesi
  onKembali: () => void
}) {
  const { submisi, memuatSubmisi, mulaiSuperSesi } = useSuperSesi()
  const [konfirmasiMulai, setKonfirmasiMulai] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useKembali(() => {
    if (konfirmasiMulai) { if (!sibuk) setKonfirmasiMulai(false); return true }
    return false
  })

  const mengumpulkan = superSesi.status === 'mengumpulkan'
  // Tidak ada lagi pengecekan "semua kiriman sudah punya pengawas" -- sejak
  // klaim bebas, siapa yang mengawas ditentukan belakangan oleh guru sendiri.
  const belumAdaKiriman = !submisi || submisi.length === 0

  // Angka ringkas di kartu atas: semuanya diturunkan dari `submisi` yang sudah
  // dipoling (pantau_super_sesi), tidak ada pemanggilan baru.
  const jumlahKiriman = submisi?.length ?? 0
  const jumlahMurid = (submisi ?? []).reduce((n, s) => n + s.jumlahMurid, 0)
  const jumlahTerkunci = (submisi ?? []).reduce(
    (n, s) => n + (s.sesiStatus === 'aktif' ? s.murid.filter(m => m.terkunciPada !== null).length : 0), 0)

  async function mulai() {
    setSibuk(true); setGalat(null)
    try {
      await mulaiSuperSesi(superSesi.id)
      setKonfirmasiMulai(false)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memulai. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-alas">
      <div className="h-14 pl-1.5 pr-4 flex items-center gap-1 shrink-0 bg-white border-b border-garis lg:hidden">
        <button type="button" aria-label="Kembali" onClick={onKembali}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta active:bg-garis-2 transition-colors">
          <Ikon nama="kembali" className="w-5.5 h-5.5" tebal={2} />
        </button>
        <div className="min-w-0">
          <p className="text-base font-bold text-tinta truncate">Super Sesi</p>
          <p className="text-[12.5px] text-teks-3 truncate">{superSesi.judul}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 flex flex-col gap-3 desktop:max-w-2xl desktop:w-full desktop:mx-auto lg:max-w-300 lg:px-8 lg:pt-6 lg:pb-10 lg:gap-5">
        <div className="rounded-[20px] bg-tinta text-white p-[18px] lg:px-7.5 lg:py-6.5 lg:flex lg:items-center lg:gap-8">
          <div className="lg:flex-[1.4] min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em]">
            {superSesi.status === 'berjalan' && <span className="w-2 h-2 rounded-full bg-hijau-muda" />}
            {mengumpulkan ? 'Mengumpulkan kiriman' : superSesi.status === 'berjalan' ? 'Berjalan' : 'Selesai'}
          </span>
          <h1 className="mt-3 text-[26px] lg:text-[30px] font-extrabold tracking-tight leading-tight break-words">{superSesi.judul}</h1>
          {superSesi.deskripsi && <p className="text-biru-muda text-sm mt-1.5">{superSesi.deskripsi}</p>}
          </div>
          <div className="grid grid-cols-3 mt-4 pt-3.5 border-t border-white/15 lg:flex-1 lg:mt-0 lg:pt-0 lg:border-t-0">
            {([['Kiriman', jumlahKiriman], ['Murid', jumlahMurid], ['Terkunci', jumlahTerkunci]] as const).map(([label, n], i) => (
              <div key={label} className={i === 0 ? '' : 'pl-3 lg:pl-5 border-l border-white/15'}>
                <p className={`text-3xl lg:text-[38px] font-extrabold tracking-tight leading-tight ${label === 'Terkunci' && n > 0 ? 'lg:text-jingga-garis' : ''}`}>{n}</p>
                <p className="text-[12.5px] text-biru-muda mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* Desktop: Mulai ada di kepala kartu (di HP di dasar layar). */}
          {mengumpulkan && (
            <button type="button" disabled={belumAdaKiriman} onClick={() => setKonfirmasiMulai(true)}
              className="max-lg:hidden shrink-0 h-12.5 px-5.5 rounded-[13px] bg-white text-tinta text-[15px] font-extrabold inline-flex items-center gap-2.25 hover:bg-biru-tint transition-colors disabled:opacity-50 disabled:pointer-events-none">
              <Ikon nama="kirim" className="w-4.5 h-4.5" tebal={2.2} />Mulai Super Sesi
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between mt-2 -mb-0.5 lg:mt-0 lg:-mb-2">
          <Eyebrow>Kiriman guru mapel · {jumlahKiriman}</Eyebrow>
          <span className="hidden lg:block text-[13px] text-teks-3">
            {mengumpulkan ? 'Kiriman baru masuk otomatis sampai kamu menekan Mulai' : 'Diperbarui otomatis tiap 10 detik'}
          </span>
        </div>

        {memuatSubmisi && submisi === null ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-biru-muda border-t-biru rounded-full animate-spin" />
          </div>
        ) : !submisi || submisi.length === 0 ? (
          <div className="bg-white rounded-[18px] border border-garis flex flex-col items-center gap-1.5 py-8 text-center px-4">
            <Ikon nama="dokumen" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
            <p className="text-[13px] text-teks-3">Belum ada guru mapel yang mengirim soal ke sini</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:gap-0 lg:bg-white lg:border lg:border-garis lg:rounded-[18px] lg:overflow-hidden">
            <div className={`hidden lg:grid ${KOLOM_KIRIMAN} items-center gap-x-3 px-5 h-10 bg-isian`}>
              {['Mapel & kelas', 'Soal dari', 'Pengawas', 'Kode', 'Murid', 'Status', ''].map((t, i) => (
                <span key={i} className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-teks-3">{t}</span>
              ))}
            </div>
            {submisi.map(s => <KartuSubmisi key={s.id} submisi={s} />)}
          </div>
        )}

        {galat && <p className="text-sm font-medium text-jingga-gelap px-1">{galat}</p>}

        {mengumpulkan && (
          <Button size="lg" fullWidth disabled={belumAdaKiriman} onClick={() => setKonfirmasiMulai(true)} className="mt-1 lg:hidden">
            <Ikon nama="kirim" className="w-4.5 h-4.5" />Mulai Super Sesi
          </Button>
        )}

        {/* Desktop: kenapa tidak ada langkah "tunjuk pengawas" -- klaim bebas (SS9). */}
        {mengumpulkan && (
          <div className="hidden lg:flex gap-3 items-start rounded-2xl bg-biru-tipis border border-biru-muda px-5 py-4">
            <Ikon nama="galat" className="w-5 h-5 text-biru mt-px shrink-0" tebal={2} />
            <p className="text-[13.5px] leading-relaxed text-tinta-2">
              <strong className="text-tinta">Tidak perlu menunjuk pengawas.</strong> Setelah kamu menekan Mulai, tiap kiriman jadi
              satu kelas yang bisa diambil guru mana pun di sekolahmu. Siapa yang mengambil duluan, dialah pengawasnya.
            </p>
          </div>
        )}
      </div>

      {konfirmasiMulai && (
        <LembarKonfirmasi
          judul="Mulai Super Sesi sekarang?"
          pesan={<>
            Soal akan didistribusikan jadi kelas yang bisa langsung diambil guru mana pun di sekolahmu. Siapa yang mengklaim duluan, dialah pengawasnya. Kiriman baru tidak lagi bisa masuk sesudah ini.
            {jumlahKiriman > 0 && (
              <span className="block mt-3 rounded-xl bg-isian border border-garis-2 px-3.5 py-2.5 text-[13.5px]">
                <strong className="text-tinta">{jumlahKiriman} kiriman</strong> akan menjadi {jumlahKiriman} kelas
              </span>
            )}
          </>}
          nada="biasa"
          labelAksi="Mulai"
          sibuk={sibuk}
          onAksi={() => void mulai()}
          onBatal={() => setKonfirmasiMulai(false)}
        />
      )}
    </div>
  )
}

function KartuSubmisi({ submisi }: { submisi: SubmisiSuperSesi }) {
  const [terbuka, setTerbuka] = useState(false)

  // Cuma sesi Super Sesi yang SUDAH lahir & masih berjalan yang punya sesuatu
  // untuk diawasi -- lihat SS2/K1 di CLAUDE.md.
  const bisaDiawasi = submisi.sesiId !== null && submisi.sesiStatus === 'aktif'
  const jumlahTerkunci = submisi.murid.filter(m => m.terkunciPada !== null).length

  const badge = submisi.sesiId ? (
    submisi.pengawasId ? (
      <Badge warna={submisi.sesiStatus === 'aktif' ? 'hijau' : 'slate'} titik={submisi.sesiStatus === 'aktif'}>
        {submisi.sesiStatus === 'aktif' ? 'Berjalan' : 'Selesai'}
      </Badge>
    ) : (
      <Badge warna="jingga">Belum diambil</Badge>
    )
  ) : (
    <Badge warna="slate">Menunggu dimulai</Badge>
  )

  return (
    <div className={`bg-white rounded-[18px] overflow-hidden lg:rounded-none lg:ring-0 lg:border-0 lg:border-t lg:border-garis-2 ${
      terbuka ? 'border border-biru ring-4 ring-biru-tint' : 'border border-garis'}`}>
      <button type="button" disabled={!bisaDiawasi} onClick={() => setTerbuka(v => !v)} aria-expanded={terbuka}
        className="w-full text-left disabled:cursor-default lg:hover:bg-isian lg:disabled:hover:bg-transparent transition-colors">
        {/* HP: kartu dengan teks di kiri dan status di kanan. */}
        <div className="flex items-start gap-3 px-4 py-3.5 lg:hidden">
          <div className="flex-1 min-w-0">
            <p className="text-base font-extrabold tracking-tight text-tinta break-words">
              {submisi.mapel || submisi.judul}
            </p>
            <p className="text-[13px] text-teks-3 mt-0.5 leading-snug">
              {submisi.kelas && `${submisi.kelas} · `}Soal: {submisi.guruMapelNama}
              {submisi.sesiId && ` · Pengawas: ${submisi.pengawasNama ?? 'belum diambil'}`}
            </p>
            {submisi.sesiId && (
              <p className="text-[13.5px] text-tinta-2 mt-2">
                {submisi.kodeJoin && <span className="font-mono font-medium">{submisi.kodeJoin} · </span>}
                {submisi.jumlahMurid} murid
                {jumlahTerkunci > 0 && <span className="text-jingga-gelap font-bold"> · {jumlahTerkunci} terkunci</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge}
            {bisaDiawasi && (
              <Ikon nama={terbuka ? 'bawah' : 'kanan'} className="w-4.5 h-4.5 text-pinggir" tebal={2.2} />
            )}
          </div>
        </div>

        {/* Desktop: satu baris tabel, tiap kolom sel sendiri. */}
        <div className={`hidden lg:grid ${KOLOM_KIRIMAN} items-center gap-x-3 px-5 min-h-16`}>
          <span className="min-w-0">
            <span className="block text-[15.5px] font-extrabold tracking-tight text-tinta">{submisi.mapel || submisi.judul}</span>
            {submisi.kelas && <span className="block text-[13px] text-teks-3 mt-px">{submisi.kelas}</span>}
          </span>
          <span className="text-sm text-tinta-2 truncate">{submisi.guruMapelNama}</span>
          <span className={`text-sm ${submisi.sesiId && !submisi.pengawasNama ? 'font-bold text-jingga-gelap' : 'text-tinta-2'}`}>
            {submisi.sesiId ? (submisi.pengawasNama ?? 'Belum diambil') : '–'}
          </span>
          <span className="font-mono text-sm font-medium text-tinta">{submisi.kodeJoin ?? '–'}</span>
          <span className="text-sm text-tinta-2">
            {submisi.sesiId ? submisi.jumlahMurid : '–'}
            {jumlahTerkunci > 0 && <span className="ml-1.5 text-xs font-bold text-jingga-gelap">{jumlahTerkunci} terkunci</span>}
          </span>
          <span>{badge}</span>
          {bisaDiawasi
            ? <Ikon nama={terbuka ? 'bawah' : 'kanan'} className="w-4.5 h-4.5 text-pinggir" tebal={2.2} />
            : <span />}
        </div>
      </button>

      {bisaDiawasi && terbuka && <PengawasanKelas submisi={submisi} />}
    </div>
  )
}

// ─── Pengawasan satu kelas (murid keluar/terkunci) ───────────────────────────
// Wewenang buka kunci untuk sesi Super Sesi ADA DI SINI, bukan di pengawas
// (permintaan pemilik produk) -- pengawas tetap lihat sesinya seperti biasa
// (mulai/akhiri, jawaban, nilai), tapi tombol buka kunci di SesiPage disembunyikan
// untuk sesi jenis ini, lihat catatan di sana. Kuncinya PER KELAS (per sesi):
// server tidak punya sakelar serentak untuk seluruh Super Sesi.

function PengawasanKelas({ submisi }: { submisi: SubmisiSuperSesi }) {
  const { aturKunciLayarSuper, bukaKunciSemuaSuper } = useSuperSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const jumlahTerkunci = submisi.murid.filter(m => m.terkunciPada !== null).length

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false) }
  }

  return (
    <div className="border-t border-garis-2">
      <div className={`px-4 py-3 flex items-center gap-3 ${submisi.kunciLayar ? 'bg-jingga-tipis' : 'bg-isian'}`}>
        <Ikon nama="kunci" className={`w-5 h-5 shrink-0 ${submisi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-tinta">Kunci layar {submisi.kunciLayar ? 'aktif' : 'nonaktif'}</p>
          {jumlahTerkunci > 0 && (
            <p className="text-xs text-jingga-gelap font-bold">{jumlahTerkunci} murid terkunci</p>
          )}
        </div>
        {jumlahTerkunci > 0 && (
          <Button size="sm" variant="danger-garis" disabled={sibuk}
            onClick={() => void jalankan(() => bukaKunciSemuaSuper(submisi.sesiId!))}>
            Buka semua
          </Button>
        )}
        <Sakelar aktif={submisi.kunciLayar} warna="jingga" label="Kunci layar kelas ini" disabled={sibuk}
          onUbah={v => void jalankan(() => aturKunciLayarSuper(submisi.sesiId!, v))} />
      </div>

      {submisi.murid.length === 0 ? (
        <p className="text-[13px] text-teks-3 px-4 py-3">Belum ada murid bergabung.</p>
      ) : (
        <div className="divide-y divide-garis-2 border-t border-garis-2 lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:p-4 lg:bg-isian">
          {submisi.murid.map(m => <BarisMuridSuper key={m.muridId} murid={m} sesiId={submisi.sesiId!} />)}
        </div>
      )}
      {galat && <p className="text-xs font-medium text-jingga-gelap px-4 py-2">{galat}</p>}
    </div>
  )
}

function BarisMuridSuper({ murid, sesiId }: { murid: MuridSuperSesi; sesiId: string }) {
  const { bukaKunciMuridSuper } = useSuperSesi()
  const [membuka, setMembuka] = useState(false)
  const [gagal, setGagal] = useState(false)
  const terkunci = murid.terkunciPada !== null

  async function buka() {
    setMembuka(true); setGagal(false)
    try { await bukaKunciMuridSuper(sesiId, murid.muridId) }
    catch { setGagal(true) }
    finally { setMembuka(false) }
  }

  const sinyal = [
    murid.keluarLayar > 0 && `${murid.keluarLayar}× keluar layar`,
    murid.hilangFokus > 0 && `${murid.hilangFokus}× aplikasi lain`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 lg:rounded-xl lg:border ${
      terkunci ? 'bg-jingga-tipis lg:border-jingga-garis' : 'lg:bg-white lg:border-garis-2'}`}>
      <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0 text-sm font-extrabold ${
        terkunci ? 'bg-jingga-tint text-jingga-gelap' : 'bg-biru-tint text-biru'}`}>
        {murid.nama.charAt(0).toUpperCase()}
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-tinta truncate">{murid.nama}</span>
        {(sinyal || terkunci) && (
          <span className="block text-xs text-teks-3">
            {terkunci && <span className="text-jingga-gelap font-bold">Terkunci</span>}{terkunci && sinyal && ' · '}{sinyal}
          </span>
        )}
        {gagal && <span className="block text-xs font-medium text-jingga-gelap">Gagal membuka kunci</span>}
      </span>
      {terkunci && (
        <Button size="sm" variant="danger-garis" disabled={membuka} onClick={() => void buka()}>
          {membuka ? '...' : 'Buka'}
        </Button>
      )}
    </div>
  )
}
