import { useState } from 'react'
import type { SuperSesi, SubmisiSuperSesi } from '../../types'
import { useSuperSesi } from '../../context/SuperSesiContext'
import { useKembali } from '../../context/NavContext'
import { Ikon } from '../../components/ui/Ikon'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { Sakelar } from '../../components/ui/Sakelar'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'
import { KonfirmasiHapus } from '../../components/KonfirmasiHapus'
import { kelasJurusan } from '../../lib/soal'

// Tabel kiriman menyesuaikan diri dengan lebar PEMBUNGKUSNYA (container query, bukan
// lebar layar), karena kontainer "Murid terkunci" duduk di sampingnya dan lebar yang
// tersisa berubah-ubah. Tiga bentuk, dipilih oleh lebar pembungkus (`@container`):
//   >= 820px  tabel penuh, 6 kolom
//   >= 560px  tabel ringkas, 4 kolom: "Soal dari" dan "Kode" dilipat ke baris kedua Mapel
//   <  560px  kartu bertumpuk (bentuk HP)
// Kolom tetapnya dijaga kecil supaya kolom Mapel tetap lega.
const KOLOM_KIRIMAN =
  'grid-cols-[minmax(0,1fr)_108px_68px_124px] @min-[820px]:grid-cols-[minmax(0,1fr)_104px_108px_84px_68px_124px]'

export function DetailSuperSesi({ superSesi, onKembali }: {
  superSesi: SuperSesi
  onKembali: () => void
}) {
  const { submisi, memuatSubmisi, mulaiSuperSesi, akhiriSuperSesi, aturKunciLayarSuper, hapusSuperSesi } = useSuperSesi()
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)
  const [konfirmasiMulai, setKonfirmasiMulai] = useState(false)
  const [konfirmasiAkhiri, setKonfirmasiAkhiri] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [sibukKunci, setSibukKunci] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useKembali(() => {
    if (konfirmasiAkhiri) { if (!sibuk) setKonfirmasiAkhiri(false); return true }
    if (konfirmasiMulai) { if (!sibuk) setKonfirmasiMulai(false); return true }
    return false
  })

  const mengumpulkan = superSesi.status === 'mengumpulkan'
  const berjalan = superSesi.status === 'berjalan'
  const selesai = superSesi.status === 'selesai'
  // Tidak ada lagi pengecekan "semua kiriman sudah punya pengawas" -- sejak
  // klaim bebas, siapa yang mengawas ditentukan belakangan oleh guru sendiri.
  const belumAdaKiriman = !submisi || submisi.length === 0

  // Angka ringkas di kartu atas: semuanya diturunkan dari `submisi` yang sudah
  // dipoling (pantau_super_sesi), tidak ada pemanggilan baru.
  const jumlahKiriman = submisi?.length ?? 0
  const jumlahMurid = (submisi ?? []).reduce((n, s) => n + s.jumlahMurid, 0)
  const jumlahTerkunci = (submisi ?? []).reduce(
    (n, s) => n + (s.sesiStatus === 'aktif' ? s.murid.filter(m => m.terkunciPada !== null).length : 0), 0)

  // Yang ikut tertutup kalau Super Sesi diakhiri: kelas yang masih aktif, diambil
  // guru ataupun belum. Dibaca dari `submisi` yang sudah dipoling, jadi bisa
  // tertinggal sampai 10 detik -- cukup untuk kalimat konfirmasi.
  const kelasAktif = (submisi ?? []).filter(s => s.sesiStatus === 'aktif')
  const kelasBelumDiambil = kelasAktif.filter(s => !s.pengawasId).length
  const muridDiKelasAktif = kelasAktif.reduce((n, s) => n + s.jumlahMurid, 0)
  // Untuk kalimat konfirmasi hapus: semua kelas yang pernah lahir, bukan cuma yang aktif.
  const kelasTerbentuk = (submisi ?? []).filter(s => s.sesiId !== null).length
  const muridSemua = (submisi ?? []).reduce((n, s) => n + s.jumlahMurid, 0)

  async function ubahKunci(aktif: boolean) {
    setSibukKunci(true); setGalat(null)
    try { await aturKunciLayarSuper(superSesi.id, aktif) }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal mengubah kunci layar. Coba lagi.') }
    finally { setSibukKunci(false) }
  }

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

  async function akhiri() {
    setSibuk(true); setGalat(null)
    try {
      await akhiriSuperSesi(superSesi.id)
      setKonfirmasiAkhiri(false)
    } catch (e) {
      setKonfirmasiAkhiri(false)
      setGalat(e instanceof Error ? e.message : 'Gagal mengakhiri Super Sesi. Coba lagi.')
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

      <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar px-4 py-4 pb-24 flex flex-col gap-3 desktop:max-w-2xl desktop:w-full desktop:mx-auto lg:max-w-300 lg:px-6 xl:px-8 lg:pt-6 lg:pb-10 lg:gap-5">
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

        {/* Kiriman di kiri, murid terkunci di kanan, mulai lg (1024px). Cuma di bawah itu
            (HP, tablet) kontainer terkunci turun ke bawah tabel. Supaya muat di 1024-1279px,
            sidebar menciut jadi rel ikon dan kolom daftar Super Sesi menyempit (lihat
            SidebarGuru, SuperSesiDesktop), dan kontainernya 240px (256px mulai xl). Kolom kiri
            adalah `@container` yang menentukan bentuk tabel kiriman (lihat KOLOM_KIRIMAN). */}
        <div className={`grid grid-cols-1 gap-3 lg:gap-5 ${
          berjalan ? 'lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_256px] lg:items-start' : ''}`}>
          <div className="@container min-w-0 flex flex-col gap-3 lg:gap-5">
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
              // shrink-0: pembungkus ini `overflow-hidden` di dalam kolom flex yang tingginya
              // terbatas, jadi tanpa ini ia MENGERUT begitu satu kelas dibuka dan baris-barisnya
              // saling menimpa alih-alih halaman menggulir.
              <div className="shrink-0 flex flex-col gap-3 @min-[560px]:gap-0 @min-[560px]:bg-white @min-[560px]:border @min-[560px]:border-garis @min-[560px]:rounded-[18px] @min-[560px]:overflow-hidden">
                <div className={`hidden @min-[560px]:grid ${KOLOM_KIRIMAN} items-center gap-x-3 px-5 h-10 bg-isian`}>
                  {/* 'Soal dari' dan 'Kode' cuma jadi kolom di bentuk penuh. */}
                  {['Mapel & kelas', 'Soal dari', 'Pengawas', 'Kode', 'Murid', 'Status'].map((t, i) => (
                    <span key={i} className={`font-mono text-[11.5px] uppercase tracking-[0.14em] text-teks-3 ${
                      t === 'Soal dari' || t === 'Kode' ? 'hidden @min-[820px]:block' : ''}`}>{t}</span>
                  ))}
                </div>
                {submisi.map(s => <KartuSubmisi key={s.id} submisi={s} />)}
              </div>
            )}
          </div>

          {berjalan && <KontainerTerkunci submisi={submisi} />}
        </div>

        {/* Kunci layar (T3): SATU sakelar untuk semua kelas Super Sesi ini, bukan per kelas.
            Menyala juga berarti kepala sekolah yang memegang izin masuk kembali murid.
            Bisa dinyalakan sebelum Mulai (kelas yang lahir mewarisinya) maupun sesudahnya;
            kontainer sendiri, sejajar dengan sakelar "Super Sesi berjalan" di bawahnya. */}
        {!selesai && (
          <div className={`flex items-start gap-3.5 rounded-[18px] border px-4 py-3.5 lg:px-5 lg:py-4 ${
            superSesi.kunciLayar ? 'bg-jingga-tipis border-jingga-garis' : 'bg-white border-garis'}`}>
            <Ikon nama="kunci" className={`w-5 h-5 mt-0.5 shrink-0 ${superSesi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-tinta">Kunci layar murid</p>
              <p className="text-[13px] text-tinta-2 mt-0.5 leading-relaxed">
                {superSesi.kunciLayar
                  ? 'Berlaku di semua kelas. Murid yang keluar dari layar, atau masuk sesudah sesi dimulai, terkunci sampai kamu mengizinkannya masuk. Pengawas tidak bisa. Waktu tetap berjalan, dan mematikan kunci membebaskan semua murid.'
                  : 'Nyalakan supaya murid yang keluar dari layar atau membuka aplikasi lain terkunci di semua kelas, dan hanya kamu yang bisa mengizinkan mereka masuk kembali. Waktu tetap berjalan.'}
              </p>
            </div>
            <Sakelar aktif={superSesi.kunciLayar} warna="jingga" label="Kunci layar murid" disabled={sibukKunci}
              onUbah={v => void ubahKunci(v)} />
          </div>
        )}

        {/* Sakelar cuma bisa dimatikan, dan mematikannya selalu lewat konfirmasi: mengakhiri
            menutup semua kelas sekaligus dan tidak bisa dibuka lagi. */}
        {!mengumpulkan && (
          <div className="flex items-center gap-3.5 bg-white rounded-[18px] border border-garis px-4 py-3.5 lg:px-5 lg:py-4">
            <Ikon nama="sesi" className={`w-5 h-5 shrink-0 ${berjalan ? 'text-hijau' : 'text-teks-3'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-tinta">{berjalan ? 'Super Sesi berjalan' : 'Super Sesi sudah diakhiri'}</p>
              <p className="text-[13px] text-teks-3 mt-0.5 leading-snug">
                {berjalan ? 'Matikan untuk mengakhiri semua kelasnya sekaligus' : 'Semua kelasnya sudah ditutup'}
              </p>
            </div>
            <Sakelar aktif={berjalan} label="Super Sesi berjalan" disabled={!berjalan || sibuk}
              onUbah={() => setKonfirmasiAkhiri(true)} />
          </div>
        )}

        {/* Hapus riwayat (H2): HANYA Super Sesi yang sudah selesai. Kontainer sendiri, sejajar
            dengan kartu "Super Sesi sudah diakhiri" di atasnya. */}
        {selesai && (
          <div className="flex items-center gap-3.5 bg-white rounded-[18px] border border-garis px-4 py-3.5 lg:px-5 lg:py-4">
            <Ikon nama="hapus" className="w-5 h-5 shrink-0 text-teks-3" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-tinta">Hapus riwayat Super Sesi</p>
              <p className="text-[13px] text-teks-3 mt-0.5 leading-snug">
                Menghapus Super Sesi ini beserta semua kelas, murid, jawaban, dan nilainya
              </p>
            </div>
            <Button size="sm" variant="danger-garis" onClick={() => setKonfirmasiHapus(true)}>Hapus</Button>
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

      {konfirmasiAkhiri && (
        <LembarKonfirmasi
          judul="Akhiri Super Sesi sekarang?"
          pesan={<>
            Semua kelas yang masih berjalan ditutup sekaligus. HP murid yang masih membuka sesi mengirim otomatis jawaban yang sudah dipilih. Murid yang sudah menutup aplikasinya tidak mendapat nilai. Kode kelas tidak bisa dipakai lagi, dan kelas yang belum diambil guru tidak bisa diambil lagi.
            <span className="block mt-3 rounded-xl bg-isian border border-garis-2 px-3.5 py-2.5 text-[13.5px]">
              <strong className="text-tinta">{kelasAktif.length} kelas</strong> akan ditutup
              {kelasBelumDiambil > 0 && <>, {kelasBelumDiambil} di antaranya belum diambil guru</>}
              {muridDiKelasAktif > 0 && <> · {muridDiKelasAktif} murid sudah bergabung</>}
            </span>
          </>}
          labelAksi="Akhiri"
          sibuk={sibuk}
          onAksi={() => void akhiri()}
          onBatal={() => setKonfirmasiAkhiri(false)}
        />
      )}

      {konfirmasiHapus && (
        <KonfirmasiHapus
          judul="Hapus Super Sesi ini?"
          pesan={<>
            “{superSesi.judul}” dihapus bersama semua kelasnya, murid yang bergabung, jawaban, dan nilainya. Nilai itu juga hilang dari layar guru pengawas.
            <span className="block mt-3 rounded-xl bg-isian border border-garis-2 px-3.5 py-2.5 text-[13.5px]">
              <strong className="text-tinta">{kelasTerbentuk} kelas</strong> · {muridSemua} murid
            </span>
            <strong className="block mt-3 text-tinta">Tidak bisa dibatalkan.</strong>
          </>}
          onHapus={() => hapusSuperSesi(superSesi.id)}
          onTutup={() => setKonfirmasiHapus(false)} />
      )}
    </div>
  )
}

function KartuSubmisi({ submisi }: { submisi: SubmisiSuperSesi }) {
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
    <div className="bg-white rounded-[18px] overflow-hidden border border-garis @min-[560px]:rounded-none @min-[560px]:border-0 @min-[560px]:border-t @min-[560px]:border-garis-2">
      {/* Sempit (< 560px, termasuk HP): kartu dengan teks di kiri dan status di kanan. */}
      <div className="flex items-start gap-3 px-4 py-3.5 @min-[560px]:hidden">
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold tracking-tight text-tinta break-words">
            {submisi.mapel || submisi.judul}
          </p>
          <p className="text-[13px] text-teks-3 mt-0.5 leading-snug">
            {kelasJurusan(submisi.kelas, submisi.jurusan) && `${kelasJurusan(submisi.kelas, submisi.jurusan)} · `}Soal: {submisi.guruMapelNama}
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
        <div className="shrink-0">{badge}</div>
      </div>

      {/* Lebar (>= 560px): satu baris tabel, tiap kolom sel sendiri. */}
      <div className={`hidden @min-[560px]:grid ${KOLOM_KIRIMAN} items-center gap-x-3 px-5 py-2.5 min-h-16`}>
        <span className="min-w-0">
          <span className="block text-[15.5px] font-extrabold tracking-tight text-tinta">{submisi.mapel || submisi.judul}</span>
          {kelasJurusan(submisi.kelas, submisi.jurusan) && (
            <span className="block text-[13px] text-teks-3 mt-px">{kelasJurusan(submisi.kelas, submisi.jurusan)}</span>
          )}
          {/* Bentuk ringkas: dua kolom yang dilipat ke sini. */}
          <span className="block text-[12.5px] text-teks-3 mt-px truncate @min-[820px]:hidden">
            Soal: {submisi.guruMapelNama}{submisi.kodeJoin && ` · ${submisi.kodeJoin}`}
          </span>
        </span>
        <span className="hidden @min-[820px]:block text-sm text-tinta-2 truncate">{submisi.guruMapelNama}</span>
        <span className={`text-sm ${submisi.sesiId && !submisi.pengawasNama ? 'font-bold text-jingga-gelap' : 'text-tinta-2'}`}>
          {submisi.sesiId ? (submisi.pengawasNama ?? 'Belum diambil') : '–'}
        </span>
        <span className="hidden @min-[820px]:block font-mono text-sm font-medium text-tinta">{submisi.kodeJoin ?? '–'}</span>
        <span className="text-sm text-tinta-2">
          {submisi.sesiId ? submisi.jumlahMurid : '–'}
          {jumlahTerkunci > 0 && <span className="ml-1.5 text-xs font-bold text-jingga-gelap">{jumlahTerkunci} terkunci</span>}
        </span>
        <span>{badge}</span>
      </div>
    </div>
  )
}

// ─── Murid terkunci (semua kelas) ────────────────────────────────────────────
// Wewenang buka kunci untuk sesi Super Sesi ADA DI SINI, bukan di pengawas
// (permintaan pemilik produk) -- pengawas tetap lihat sesinya seperti biasa
// (mulai/akhiri, jawaban, nilai), tapi tombol buka kunci di SesiPage disembunyikan
// untuk sesi jenis ini, lihat catatan di sana. Kunci layarnya SATU untuk seluruh
// Super Sesi (kartu "Kunci layar murid", T3), dan murid yang terkunci dikumpulkan
// di SATU kontainer ini untuk semua kelas -- cuma nama, kelas, dan sakelar Buka --
// itulah "izin masuk kembali". Dirangkum dari `submisi` yang sudah dipoling.
//
// Bentuknya KEMBAR kontainer kiriman di sebelahnya: judul kecil di atas kartu (baris
// yang sama tinggi, supaya tepi atas kedua kartu sejajar), kartu putih bersudut sama,
// dan keadaan kosong yang sama. Barisnya memakai ukuran huruf kartu kiriman.

function KontainerTerkunci({ submisi }: { submisi: SubmisiSuperSesi[] | null }) {
  const { bukaKunciMuridSuper } = useSuperSesi()
  // Yang sedang dibuka: sakelarnya tampil menyala sampai baris itu hilang dari poling berikutnya.
  const [membuka, setMembuka] = useState<ReadonlySet<string>>(new Set())
  const [galat, setGalat] = useState<string | null>(null)

  // Yang paling lama menunggu di atas.
  const terkunci = (submisi ?? [])
    .flatMap(s => s.sesiId !== null && s.sesiStatus === 'aktif'
      ? s.murid.filter(m => m.terkunciPada !== null).map(m => ({
          kunci: `${s.sesiId}|${m.muridId}`, sesiId: s.sesiId!, muridId: m.muridId, nama: m.nama,
          kelas: kelasJurusan(s.kelas, s.jurusan) || s.mapel || s.judul,
          sejak: new Date(m.terkunciPada!).getTime(),
        }))
      : [])
    .sort((a, b) => a.sejak - b.sejak)

  async function buka(t: (typeof terkunci)[number]) {
    setMembuka(prev => new Set(prev).add(t.kunci)); setGalat(null)
    try { await bukaKunciMuridSuper(t.sesiId, t.muridId) }
    catch { setGalat(`Gagal membuka kunci ${t.nama}. Coba lagi.`) }
    finally {
      setMembuka(prev => { const n = new Set(prev); n.delete(t.kunci); return n })
    }
  }

  return (
    <section aria-label="Murid terkunci" className="min-w-0 flex flex-col gap-3 lg:gap-5 lg:sticky lg:top-0">
      <div className="flex items-baseline justify-between mt-2 -mb-0.5 lg:mt-0 lg:-mb-2">
        <Eyebrow>Murid terkunci · {terkunci.length}</Eyebrow>
        {/* Tak terlihat saat kosong (bukan dihapus): tinggi baris judul harus sama dengan
            baris di kolom kiri supaya tepi atas kedua kartu sejajar. */}
        <span className={`text-[13px] text-teks-3 ${terkunci.length === 0 ? 'invisible' : ''}`}>Buka</span>
      </div>

      {terkunci.length === 0 ? (
        <div className="bg-white rounded-[18px] border border-garis flex flex-col items-center gap-1.5 py-8 text-center px-4">
          <Ikon nama="kunci" className="w-8 h-8 text-pinggir-2" tebal={1.5} />
          <p className="text-[13px] text-teks-3">Tidak ada murid yang terkunci</p>
        </div>
      ) : (
        <ul className="bg-white rounded-[18px] border border-garis overflow-hidden divide-y divide-garis-2">
          {terkunci.map(t => (
            <li key={t.kunci} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-base font-extrabold tracking-tight text-tinta truncate">{t.nama}</p>
                <p className="text-[13px] text-teks-3 mt-0.5 truncate">{t.kelas}</p>
              </div>
              <Sakelar aktif={membuka.has(t.kunci)} warna="jingga" label={`Buka kunci ${t.nama}`}
                disabled={membuka.has(t.kunci)} onUbah={() => void buka(t)} />
            </li>
          ))}
        </ul>
      )}
      {galat && <p className="text-xs font-medium text-jingga-gelap px-1">{galat}</p>}
    </section>
  )
}
