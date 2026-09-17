import { useCallback, useRef, useState } from 'react'
import { LayarAktif, useKembali } from '../../context/NavContext'
import { BilahTab, IKON, type ItemTab } from '../../components/BilahTab'
import { SesiPage } from './SesiPage'
import { BankSoalPage } from './BankSoalPage'
import { SayaPage } from '../SayaPage'

type TabGuru = 'sesi' | 'bankSoal' | 'saya'

const NAV: ItemTab<TabGuru>[] = [
  { id: 'sesi', label: 'Sesi', ikon: IKON.sesi },
  { id: 'bankSoal', label: 'Bank Soal', ikon: IKON.bankSoal },
  { id: 'saya', label: 'Saya', ikon: IKON.saya },
]

// Bawaan = Sesi: guru membuka aplikasi di depan kelas untuk menjalankan sesi.
const TAB_BAWAAN: TabGuru = 'sesi'

export function GuruHome() {
  const [tab, setTab] = useState<TabGuru>(TAB_BAWAAN)
  // Layar penuh DILAPORKAN per tab, dan yang dibaca cuma milik tab yang tampil.
  // Satu flag bersama (navHidden di Luang) bisa ditimpa tab yang tidak terlihat,
  // karena tab yang pernah dibuka tetap ter-mount.
  const [penuhPerTab, setPenuhPerTab] = useState<Record<TabGuru, boolean>>({ sesi: false, bankSoal: false, saya: false })
  const laporSesi = useCallback((v: boolean) => setPenuhPerTab(p => p.sesi === v ? p : { ...p, sesi: v }), [])
  const laporBank = useCallback((v: boolean) => setPenuhPerTab(p => p.bankSoal === v ? p : { ...p, bankSoal: v }), [])

  // Tab yang pernah dibuka tetap ter-mount (disembunyikan lewat CSS). Untuk Sesi
  // ini bukan sekadar kenyamanan: Realtime peserta dan form yang setengah terisi
  // tidak boleh hilang hanya karena guru melirik Bank Soal.
  const dikunjungi = useRef(new Set<TabGuru>([TAB_BAWAAN]))
  dikunjungi.current.add(tab)

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* HARUS anak pertama: penangan kembali diperiksa dari yang TERAKHIR
          mendaftar, jadi penjaga ini diperiksa paling akhir -- setelah lapisan
          milik tab mana pun ditutup. */}
      <PenjagaTab tab={tab} onPulang={() => setTab(TAB_BAWAAN)} />

      <div className="flex-1 min-h-0 relative">
        {NAV.map(({ id }) => dikunjungi.current.has(id) && (
          <div key={id} className={tab === id ? 'h-full overflow-y-auto overscroll-contain tab-masuk' : 'hidden'}>
            <LayarAktif aktif={tab === id}>
              {id === 'sesi' ? <SesiPage onLayarPenuh={laporSesi} />
                : id === 'bankSoal' ? <BankSoalPage onLayarPenuh={laporBank} />
                : <SayaPage />}
            </LayarAktif>
          </div>
        ))}
      </div>

      {!penuhPerTab[tab] && <BilahTab items={NAV} aktif={tab} onPilih={setTab} />}
    </div>
  )
}

function PenjagaTab({ tab, onPulang }: { tab: TabGuru; onPulang: () => void }) {
  useKembali(() => {
    if (tab === TAB_BAWAAN) return false
    onPulang()
    return true
  })
  return null
}
