import { Ikon, type NamaIkon } from './ui/Ikon'

// ─── Bilah tab bawah ─────────────────────────────────────────────────────────
// Bentuk & perilakunya disalin dari BottomNav Luang: `fixed` dijepit ke lebar
// KARTU (max-w-107.5 = 430px, sama dengan `body` di index.css), bukan ke lebar
// jendela, plus penanda tipis yang MENGGESER dari slot ke slot.
//
// Penanda geser itu satu-satunya umpan balik ARAH yang dipunyai perpindahan
// tab: isi tabnya sendiri cuma memudar (`.tab-masuk`), karena transform pada
// wadah tab akan menjadikannya containing block untuk semua `position: fixed`
// di dalamnya dan semuanya ikut tersentak. Di dalam bilah ini transform aman --
// tidak ada apa pun ber-posisi `fixed` di dalamnya.

export type TabGuru = 'riwayat' | 'menu' | 'saya' | 'sesi' | 'superSesi'

const NAV: { id: Exclude<TabGuru, 'sesi' | 'superSesi'>; label: string; ikon: NamaIkon }[] = [
  { id: 'riwayat', label: 'Riwayat', ikon: 'dokumen' },
  { id: 'menu', label: 'Menu', ikon: 'kisi' },
  { id: 'saya', label: 'Saya', ikon: 'profil' },
]

/**
 * Sesi & Super Sesi diakses lewat kartu di Menu, bukan slot tab sendiri -- ia
 * menumpang sorotan Menu, persis `tabUntukHighlight` di Luang. Tanpa ini tidak
 * ada satu pun slot yang tersorot selama guru berada di layar itu, dan
 * penandanya melompat ke slot 0 yang salah.
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
  // Dijepit ke 0 supaya penanda tidak pernah melompat keluar bilah kalau suatu
  // saat ada TabGuru yang tidak punya slotnya sendiri di sini.
  const indeks = Math.max(0, NAV.findIndex(n => n.id === sorotan))

  return (
    <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-107.5 bg-white border-t border-slate-100 z-40 safe-bottom transition-transform duration-300 ease-out ${
      tersembunyi ? 'translate-y-full' : 'translate-y-0'
    }`}>
      <div className="relative flex">
        <span aria-hidden
          className="absolute top-0 left-0 h-0.5 flex justify-center transition-transform duration-300 ease-out"
          style={{ width: `${100 / NAV.length}%`, transform: `translateX(${indeks * 100}%)` }}>
          <span className="w-8 h-full rounded-full bg-indigo-600" />
        </span>
        {NAV.map(n => {
          const nyala = sorotan === n.id
          return (
            <button key={n.id} type="button" onClick={() => onPilih(n.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors ${
                nyala ? 'text-indigo-600' : 'text-slate-400'}`}>
              <span className="relative">
                <Ikon nama={n.ikon} className="w-6 h-6" tebal={nyala ? 2 : 1.5} />
                {/* Titik hijau di slot Menu = ada sesi yang masih dibuka. Guru
                    yang menutup aplikasi di tengah jam pelajaran tidak punya
                    penanda lain bahwa kelasnya masih menunggu. */}
                {n.id === 'menu' && lencanaSesi > 0 && (
                  <span className="absolute -top-0.5 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold tracking-wide">{n.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
