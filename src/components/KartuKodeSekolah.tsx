import { useState } from 'react'
import { useSekolahSaya } from '../lib/useSekolahSaya'
import { Ikon } from './ui/Ikon'

// ─── Kartu Kode sekolah (kepala sekolah) ─────────────────────────────────────
// Kode ini satu-satunya yang menghubungkan guru ke sekolahnya: guru baru
// memasukkannya di layar Daftar, guru lama di layar Hubungkan ke Sekolah. Guru
// diberi tahu "tanyakan ke kepala sekolahmu", jadi kepala sekolah HARUS bisa
// melihatnya di aplikasi -- tanpa kartu ini kodenya cuma ada di database.
//
// Peringatannya bukan basa-basi: kode tidak punya masa berlaku dan tidak bisa
// diputar dari aplikasi (lihat "Yang belum ditangani" di CLAUDE.md), jadi siapa
// pun yang tahu kodenya bisa mendaftar sebagai guru sekolah ini.

export function KartuKodeSekolah({ className = '' }: { className?: string }) {
  const sekolah = useSekolahSaya(true)
  const [status, setStatus] = useState<string | null>(null)

  async function salin() {
    if (!sekolah) return
    try {
      await navigator.clipboard.writeText(sekolah.kode)
      setStatus('Tersalin')
    } catch {
      // Clipboard butuh konteks aman + izin; kodenya tetap bisa diseleksi manual.
      setStatus('Salin manual kode di atas')
    }
    setTimeout(() => setStatus(null), 2200)
  }

  return (
    <section aria-label="Kode sekolah" className={`bg-white rounded-[18px] border border-garis p-5 ${className}`}>
      <h3 className="text-[16.5px] font-extrabold tracking-tight text-tinta">Kode sekolah</h3>
      {sekolah === undefined ? (
        <div className="mt-3.5 h-15 rounded-xl bg-isian animate-pulse" />
      ) : sekolah === null ? (
        <p className="mt-2 text-[13px] leading-snug text-jingga-gelap">Kode sekolah belum bisa dimuat. Muat ulang halaman ini.</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] leading-snug text-teks-3">
            Bagikan ke guru mapel di {sekolah.nama}. Mereka memasukkannya saat mendaftar, supaya akunnya
            terhubung ke sekolahmu dan kelas Super Sesi sampai ke mereka.
          </p>
          <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-isian border border-garis-2 pl-4 pr-1.5 py-1.5">
            <span className="flex-1 min-w-0 truncate font-mono text-[22px] font-medium tracking-[0.08em] text-tinta select-all">
              {sekolah.kode}
            </span>
            <button type="button" onClick={() => void salin()}
              className="h-10 px-3.5 shrink-0 rounded-[10px] border-[1.5px] border-pinggir-2 bg-white text-[13.5px] font-bold text-tinta inline-flex items-center gap-1.5 hover:bg-isian transition-colors">
              <Ikon nama={status === 'Tersalin' ? 'centang' : 'duplikat'} className="w-4 h-4" tebal={2.2} />
              {status === 'Tersalin' ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          {status && status !== 'Tersalin' && <p className="mt-2 text-xs font-bold text-tinta-2">{status}</p>}
          <p className="mt-2.5 text-xs leading-snug text-teks-3">
            Siapa pun yang tahu kode ini bisa mendaftar sebagai guru di sekolahmu. Jangan bagikan ke murid.
          </p>
        </>
      )}
    </section>
  )
}
