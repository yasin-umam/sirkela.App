import { Ikon, type NamaIkon } from './ui/Ikon'

// ─── Bilah tab bawah ─────────────────────────────────────────────────────────
// `fixed` dijepit ke lebar KARTU (max-w-107.5 = 430px, sama dengan `body` di
// index.css), bukan ke lebar jendela. Slot yang aktif ditandai PIL biru-tint di
// belakang ikonnya dan label yang menebal (desain "Lembar Jawab" menggantikan
// penanda garis yang menggeser dari desain Luang).
//
// Perpindahan tab cuma memudar (`.tab-masuk`), tidak menggeser: transform pada
// wadah tab akan menjadikannya containing block untuk semua `position: fixed`
// di dalamnya dan semuanya tersentak.

export type TabGuru = 'riwayat' | 'menu' | 'saya' | 'sesi' | 'superSesi'

const NAV: { id: Exclude<TabGuru, 'sesi' | 'superSesi'>; label: string; ikon: NamaIkon }[] = [
  { id: 'riwayat', label: 'Riwayat', ikon: 'dokumen' },
  { id: 'menu', label: 'Menu', ikon: 'kisi' },
  { id: 'saya', label: 'Saya', ikon: 'profil' },
]

/**
 * Sesi & Super Sesi diakses lewat kartu di Menu, bukan slot tab sendiri -- ia
 * menumpang sorotan Menu. Tanpa ini tidak ada satu pun slot yang tersorot
 * selama guru berada di layar itu.
 */
export function tabUntukSorotan(tab: TabGuru): Exclude<TabGuru, 'sesi' | 'superSesi'> {
  return tab === 'sesi' || tab === 'superSesi' ? 'menu' : tab
}

export function BottomNav({ tab, onPilih, tersembunyi, lencanaSesi = 0 }: {
  tab: TabGuru
  onPilih: (tab: Exclude<TabGuru, 'sesi' | 'superSesi'>) => void
  /** Layar penuh sedang terbuka (editor, sesi aktif) -- bilah meluncur keluar. */
  tersembunyi: boolean
  /** Jumlah sesi yang masih dibuka, tampil sebagai titik hijau di slot Menu. */
  lencanaSesi?: number
}) {
  const sorotan = tabUntukSorotan(tab)

  return (
    <nav aria-label="Navigasi utama"
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-107.5 desktop:max-w-2xl bg-white border-t border-garis z-40 lg:hidden safe-bottom transition-transform duration-300 ease-out ${
        tersembunyi ? 'translate-y-full' : 'translate-y-0'
      }`}>
      <div className="flex px-2 pt-2">
        {NAV.map(n => {
          const nyala = sorotan === n.id
          return (
            <button key={n.id} type="button" onClick={() => onPilih(n.id)}
              aria-current={nyala ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 pb-1 transition-colors">
              <span className={`relative w-15 h-8 rounded-full flex items-center justify-center transition-colors ${
                nyala ? 'bg-biru-tint text-biru' : 'text-teks-3'}`}>
                <Ikon nama={n.ikon} className="w-5.5 h-5.5" tebal={nyala ? 2 : 1.8} />
                {/* Titik hijau di slot Menu = ada sesi yang masih dibuka. Guru
                    yang menutup aplikasi di tengah jam pelajaran tidak punya
                    penanda lain bahwa kelasnya masih menunggu. */}
                {n.id === 'menu' && lencanaSesi > 0 && (
                  <span className="absolute top-0.5 right-2.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hijau opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-hijau" />
                  </span>
                )}
              </span>
              <span className={`text-xs ${nyala ? 'font-extrabold text-tinta' : 'font-semibold text-teks-3'}`}>{n.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
