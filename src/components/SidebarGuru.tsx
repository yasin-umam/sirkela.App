import { useAuth } from '../context/AuthContext'
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

function Item({ aktif, label, ikon, onClick, lencana }: {
  aktif: boolean
  label: string
  ikon: NamaIkon
  onClick: () => void
  lencana?: number
}) {
  return (
    <button type="button" onClick={onClick} aria-current={aktif ? 'page' : undefined}
      className={`w-full h-11.5 px-3.5 rounded-xl flex items-center gap-3 text-[15px] text-left transition-colors ${
        aktif ? 'bg-biru-tint text-biru font-extrabold' : 'text-tinta-2 font-semibold hover:bg-isian'}`}>
      <Ikon nama={ikon} className="w-5 h-5" tebal={aktif ? 2 : 1.8} />
      <span className="flex-1">{label}</span>
      {lencana != null && lencana > 0 && (
        <span className="inline-flex items-center gap-1.25 px-2.25 py-0.5 rounded-full bg-hijau-tint text-hijau text-xs font-extrabold">
          <span className="w-1.5 h-1.5 rounded-full bg-hijau" />{lencana}
        </span>
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
  const peran = kepsek ? 'Kepala sekolah' : 'Guru'
  const sayaAktif = tab === 'saya'

  return (
    <aside className="hidden lg:flex w-66 shrink-0 flex-col bg-white border-r border-garis px-4 pt-6 pb-5">
      <div className="flex items-center gap-3 px-1.5">
        <Lambang className="w-10.5 h-10.5 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[14.5px] font-extrabold tracking-tight leading-tight text-tinta">{NAMA_APLIKASI}</p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-teks-3 mt-0.5">{peran}</p>
        </div>
      </div>

      <nav aria-label="Navigasi utama" className="mt-8 flex flex-col gap-1">
        <Item aktif={tab === 'menu'} label="Menu" ikon="kisi" onClick={() => onPilih('menu')} />
        <Item aktif={tab === 'riwayat'} label="Riwayat" ikon="dokumen" onClick={() => onPilih('riwayat')} />
        <Item aktif={tab === 'sesi'} label="Sesi" ikon="sesi" lencana={sesiBerjalan} onClick={() => onPilih('sesi')} />
        {kepsek && (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-teks-3 mt-5.5 mb-2 px-3.5">Kepala sekolah</p>
            <Item aktif={tab === 'superSesi'} label="Super Sesi" ikon="perisai" onClick={() => onPilih('superSesi')} />
          </>
        )}
      </nav>

      <div className="flex-1" />

      <div className={`flex items-center gap-1 rounded-[14px] border p-1.5 ${
        sayaAktif ? 'border-biru bg-biru-tipis' : 'border-garis'}`}>
        <button type="button" onClick={() => onPilih('saya')} aria-current={sayaAktif ? 'page' : undefined}
          className="flex-1 min-w-0 flex items-center gap-3 p-1.5 rounded-[10px] text-left hover:bg-isian transition-colors">
          <span className="w-10 h-10 rounded-xl bg-tinta text-white flex items-center justify-center text-[15px] font-extrabold shrink-0">
            {(user?.nama ?? '?').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-tinta truncate">{user?.nama}</span>
            <span className="block text-[12.5px] text-teks-3">{peran}</span>
          </span>
        </button>
        <button type="button" onClick={onKeluar} aria-label="Keluar" title="Keluar"
          className="w-10 h-10 shrink-0 rounded-[10px] flex items-center justify-center text-teks-3 hover:bg-garis-2 hover:text-tinta transition-colors">
          <Ikon nama="keluar" className="w-4.5 h-4.5" tebal={1.9} />
        </button>
      </div>
    </aside>
  )
}
