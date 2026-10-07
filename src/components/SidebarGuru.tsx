import { useAuth } from '../context/AuthContext'
import { useSuperSesi } from '../context/SuperSesiContext'
import { NAMA_APLIKASI } from '../lib/aplikasi'
import { Lambang } from './Logo'
import { Ikon, type NamaIkon } from './ui/Ikon'
import type { TabGuru } from './BottomNav'

// ─── Sidebar guru (desktop, ≥ 1024px) ────────────────────────────────────────
// Pengganti BottomNav di layar lebar. Beda dari HP dalam satu hal struktural:
// Sesi (dan Super Sesi untuk kepala sekolah) punya item sendiri di sini,
// sedangkan di HP keduanya menumpang sorotan Menu (`tabUntukSorotan`) karena
// bilah bawah cuma punya tiga slot. Tab "Saya" diwakili kartu akun di dasar
// sidebar, dengan tombol Keluar di sebelahnya.
//
// Lebar 232px (desain "Meja Pengawas", 2026-10-06): sidebar cuma peta navigasi;
// judul halaman dan aksi cepat ada di bilah atas (BilahAtas). Di 1024-1279px
// (2026-10-07) ia menciut jadi REL IKON 72px -- tanpa label, nama aplikasi, dan nama
// akun; lencana jadi titik hijau -- supaya layar Super Sesi tetap muat memasang
// kontainer "Murid terkunci" di samping tabel kiriman. Nama tiap item tetap ada
// sebagai `aria-label`/`title`.

function Item({ aktif, label, ikon, onClick, lencana }: {
  aktif: boolean
  label: string
  ikon: NamaIkon
  onClick: () => void
  lencana?: number
}) {
  const ada = lencana != null && lencana > 0
  return (
    <button type="button" onClick={onClick} aria-current={aktif ? 'page' : undefined}
      aria-label={ada ? `${label}, ${lencana} berjalan` : label} title={label}
      className={`relative w-full h-10.5 px-0 xl:px-3 rounded-[10px] flex items-center justify-center xl:justify-start gap-0 xl:gap-3 text-[14.5px] text-left transition-colors ${
        aktif ? 'bg-biru-tint text-biru font-extrabold' : 'text-tinta-2 font-semibold hover:bg-isian'}`}>
      <Ikon nama={ikon} className="w-5 h-5" tebal={aktif ? 2 : 1.8} />
      <span className="hidden xl:block flex-1">{label}</span>
      {ada && (
        <>
          <span className="hidden xl:inline-flex items-center gap-1.25 px-2.25 py-0.5 rounded-full bg-hijau-tint text-hijau text-xs font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-hijau" />{lencana}
          </span>
          <span aria-hidden className="xl:hidden absolute top-1.5 right-3 w-2 h-2 rounded-full bg-hijau ring-2 ring-white" />
        </>
      )}
    </button>
  )
}

export function SidebarGuru({ tab, onPilih, sesiBerjalan, kepsek, onKeluar }: {
  tab: TabGuru
  onPilih: (tab: TabGuru) => void
  /** Jumlah sesi yang masih dibuka -- titik hijau di item Sesi. */
  sesiBerjalan: number
  kepsek: boolean
  onKeluar: () => void
}) {
  const { user } = useAuth()
  const { semuaSuperSesi } = useSuperSesi()
  const peran = kepsek ? 'Kepala sekolah' : 'Guru'
  const sayaAktif = tab === 'saya'
  const superBerjalan = semuaSuperSesi.filter(s => s.status === 'berjalan').length

  return (
    <aside className="hidden lg:flex w-18 xl:w-58 shrink-0 flex-col bg-white border-r border-garis px-2 xl:px-3.5 pt-5 pb-5">
      <div className="flex items-center justify-center xl:justify-start gap-3 xl:px-1.5">
        <Lambang className="w-10 h-10" />
        <div className="hidden xl:block min-w-0">
          <p className="text-sm font-extrabold tracking-tight leading-tight text-tinta">{NAMA_APLIKASI}</p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-teks-3 mt-0.5">{peran}</p>
        </div>
      </div>

      <nav aria-label="Navigasi utama" className="mt-7 flex flex-col gap-0.5">
        <Item aktif={tab === 'menu'} label="Menu" ikon="kisi" onClick={() => onPilih('menu')} />
        <Item aktif={tab === 'riwayat'} label="Riwayat" ikon="dokumen" onClick={() => onPilih('riwayat')} />
        <Item aktif={tab === 'sesi'} label="Sesi" ikon="sesi" lencana={sesiBerjalan} onClick={() => onPilih('sesi')} />
        {kepsek && (
          <>
            <p className="hidden xl:block font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 mt-5 mb-1.5 px-3">Kepala sekolah</p>
            {/* Rel ikon: pemisah tipis menggantikan label kelompok. */}
            <div aria-hidden className="xl:hidden mx-2 my-2.5 border-t border-garis" />
            <Item aktif={tab === 'superSesi'} label="Super Sesi" ikon="perisai" lencana={superBerjalan} onClick={() => onPilih('superSesi')} />
          </>
        )}
      </nav>

      <div className="flex-1" />

      <div className={`flex flex-col xl:flex-row items-center gap-1 rounded-[14px] border p-1 xl:p-1.5 ${
        sayaAktif ? 'border-biru bg-biru-tipis' : 'border-garis'}`}>
        <button type="button" onClick={() => onPilih('saya')} aria-current={sayaAktif ? 'page' : undefined}
          aria-label={`Akun saya, ${user?.nama ?? ''}`} title={user?.nama}
          className="xl:flex-1 min-w-0 flex items-center justify-center xl:justify-start gap-2.5 p-1 xl:p-1.5 rounded-[10px] text-left hover:bg-isian transition-colors">
          <span className="w-9 h-9 rounded-[11px] bg-tinta text-white flex items-center justify-center text-sm font-extrabold shrink-0">
            {(user?.nama ?? '?').charAt(0).toUpperCase()}
          </span>
          <span className="hidden xl:block min-w-0">
            <span className="block text-[13.5px] font-bold text-tinta truncate">{user?.nama}</span>
            <span className="block text-[12.5px] text-teks-3">{peran}</span>
          </span>
        </button>
        <button type="button" onClick={onKeluar} aria-label="Keluar" title="Keluar"
          className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center text-teks-3 hover:bg-garis-2 hover:text-tinta transition-colors">
          <Ikon nama="keluar" className="w-4.5 h-4.5" tebal={1.9} />
        </button>
      </div>
    </aside>
  )
}
