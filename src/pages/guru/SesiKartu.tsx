import { useEffect, useState } from 'react'
import type { SesiKelas } from '../../types'
import { useSesi } from '../../context/SesiContext'
import { Button } from '../../components/ui/Button'
import { Ikon } from '../../components/ui/Ikon'
import { Sakelar } from '../../components/ui/Sakelar'
import { LembarKonfirmasi } from '../../components/LembarKonfirmasi'

// ─── Kartu kendali sesi yang dipakai HP (SesiPage) DAN desktop (SesiDesktop) ──
// Durasi pengerjaan, kunci layar, dan konfirmasi akhiri: aturan dan kalimatnya
// satu, jadi ditulis sekali di sini.

export const DURASI_CEPAT = [15, 30, 45, 60]

/** Dipakai kendali HP dan desktop: kalimat konsekuensinya satu. */
export function KonfirmasiAkhiri({ sibuk, onAksi, onBatal }: { sibuk: boolean; onAksi: () => void; onBatal: () => void }) {
  return (
    <LembarKonfirmasi
      judul="Akhiri sesi sekarang?"
      pesan="HP murid yang masih membuka sesi ini mengirim otomatis jawaban yang sudah dipilih. Murid yang sudah menutup aplikasinya tidak mendapat nilai. Kode sesi tidak bisa dipakai lagi."
      labelAksi="Akhiri"
      sibuk={sibuk}
      onAksi={onAksi}
      onBatal={onBatal}
    />
  )
}

// ─── Durasi pengerjaan ───────────────────────────────────────────────────────
// Dulu diatur dari TabSetelan di editor formulir; dibuang 2026-09-22 karena
// durasi & kunci layar dua-duanya "milik sesi", bukan formulir -- kunci layar
// sudah diatur dari sini (KartuKunciLayar di bawah), sekarang durasi menyusul.
// Cuma tampil SEBELUM "Mulai sesi" ditekan (lihat guard di SesiAktifView) --
// server (atur_durasi_sesi) menolak begitu mulai_pada terisi, karena Hitungan
// sudah menghitung tenggat dari angka itu dan murid sudah melihatnya.

export function KartuDurasi({ sesi }: { sesi: SesiKelas }) {
  const { aturDurasiSesi } = useSesi()
  const [durasi, setDurasi] = useState(() => String(sesi.durasiMenit))
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => { setDurasi(String(sesi.durasiMenit)) }, [sesi.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce sebelum kirim ke server -- sama pola dengan autosave formulir,
  // supaya ketikan manual tidak memicu satu RPC per digit.
  useEffect(() => {
    const n = Number(durasi)
    if (!Number.isInteger(n) || n < 1 || n > 600 || n === sesi.durasiMenit) return
    const id = setTimeout(() => {
      aturDurasiSesi(sesi.id, n).catch(e => setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.'))
    }, 600)
    return () => clearTimeout(id)
  }, [durasi, sesi.id, sesi.durasiMenit, aturDurasiSesi])

  const angka = Number(durasi)
  const valid = Number.isInteger(angka) && angka >= 1 && angka <= 600

  return (
    <div className="bg-white rounded-[18px] border border-garis p-4 flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-extrabold text-tinta">Durasi pengerjaan</p>
        <p className="text-[13px] text-teks-3 mt-0.5 leading-relaxed">
          Hitung mundur dimulai saat kamu menekan Mulai sesi. Masih bisa diubah sampai itu ditekan.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DURASI_CEPAT.map(d => (
          <button key={d} type="button" onClick={() => setDurasi(String(d))} aria-pressed={angka === d}
            className={`h-11 rounded-xl text-sm font-bold border-[1.5px] transition-colors ${
              angka === d
                ? 'bg-biru text-white border-biru'
                : 'bg-white text-tinta-2 border-garis hover:border-biru'}`}>
            {d} mnt
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-[13px] text-teks-3 shrink-0">Atau isi manual</span>
        <input type="number" inputMode="numeric" min={1} max={600} value={durasi}
          onChange={e => setDurasi(e.target.value)}
          onWheel={e => e.currentTarget.blur()}
          className={`w-20 h-11 px-3 rounded-xl border-[1.5px] text-sm font-bold text-right text-tinta outline-none transition-colors ${
            valid ? 'border-pinggir-2 focus:border-biru' : 'border-jingga'}`} />
        <span className="text-[13px] text-teks-3">menit</span>
      </label>
      {galat && <p className="text-xs font-medium text-jingga-gelap">{galat}</p>}
    </div>
  )
}

// ─── Kunci layar di sesi berjalan ────────────────────────────────────────────
// Mematikan = membebaskan semua yang sedang terkunci. "Buka semua" = jalan
// keluar yang sama tanpa mematikan kuncinya. Keduanya dua langkah: layar guru
// sering tampil di papan tulis pintar.
//
// Satu kalimat akibat WAJIB ada di samping sakelarnya: "waktunya tetap
// berjalan" ditanggung murid, dan guru yang menyalakannya harus tahu itu
// sebelum menyalakan, bukan setelah ada murid yang ditelepon orang tuanya di
// tengah ulangan.

export function KartuKunciLayar({ sesi }: { sesi: SesiKelas }) {
  const { aturKunciLayar, bukaKunciSemua } = useSesi()
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const terkunci = sesi.kunciLayar ? sesi.muridJoined.filter(p => p.terkunciPada !== null).length : 0
  // Wewenang kunci layar untuk sesi Super Sesi ADA DI kepala sekolah (server
  // menolak atur_kunci_layar/buka_kunci_semua untuk sesi jenis ini) -- kartu
  // ini jadi informasi saja, bukan kendali, supaya tidak menjanjikan aksi yang
  // akan ditolak server.
  const terpusat = sesi.superSesiId != null

  async function jalankan(aksi: () => Promise<void>) {
    setSibuk(true); setGalat(null)
    try { await aksi() } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal, coba lagi.') }
    finally { setSibuk(false); setKonfirmasi(false) }
  }

  if (terpusat) {
    return (
      <div className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-[18px] border ${
        sesi.kunciLayar ? 'bg-jingga-tipis border-jingga-garis' : 'bg-white border-garis'}`}>
        <Ikon nama="kunci" className={`w-5.5 h-5.5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-tinta">
            Kunci layar murid: {sesi.kunciLayar ? 'aktif' : 'nonaktif'}
          </span>
          <span className="block text-[13px] text-tinta-2 mt-0.5 leading-relaxed">
            Sesi ini bagian dari Super Sesi. Kepala sekolah yang mengatur kunci layar dan membuka kunci murid, bukan kamu.
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className={`rounded-[18px] border overflow-hidden ${
      sesi.kunciLayar ? 'bg-jingga-tipis border-jingga-garis' : 'bg-white border-garis'}`}>
      <div className="px-4 py-3.5 flex items-start gap-3">
        <Ikon nama="kunci" className={`w-5.5 h-5.5 mt-0.5 shrink-0 ${sesi.kunciLayar ? 'text-jingga' : 'text-teks-3'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-tinta">Kunci layar murid</p>
          <p className="text-[13px] text-tinta-2 mt-0.5 leading-relaxed">
            Murid yang keluar layar atau membuka aplikasi lain terkunci sampai kamu membukanya.
            Waktunya tetap berjalan. Mematikannya membebaskan semua yang sedang terkunci.
          </p>
        </div>
        <Sakelar aktif={sesi.kunciLayar} warna="jingga" label="Kunci layar murid" disabled={sibuk}
          onUbah={v => void jalankan(() => aturKunciLayar(sesi.id, v))} />
      </div>

      {terkunci > 0 && (
        <div className="border-t border-jingga-garis px-4 py-2.5 flex items-center gap-2">
          <p className="text-[13.5px] text-tinta flex-1">
            <strong className="font-extrabold">{terkunci} murid</strong> sedang terkunci
          </p>
          {konfirmasi ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setKonfirmasi(false)} disabled={sibuk}>Batal</Button>
              <Button variant="danger" size="sm" onClick={() => void jalankan(() => bukaKunciSemua(sesi.id))} disabled={sibuk}>
                {sibuk ? '...' : 'Ya, buka semua'}
              </Button>
            </>
          ) : (
            <Button variant="danger-garis" size="sm" onClick={() => setKonfirmasi(true)}>Buka semua</Button>
          )}
        </div>
      )}
      {galat && <p className="text-xs font-medium text-jingga-gelap px-4 pb-3">{galat}</p>}
    </div>
  )
}
