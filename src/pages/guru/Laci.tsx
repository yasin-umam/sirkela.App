import { useAuth } from '../../context/AuthContext'
import { useFormulir } from '../../context/FormulirContext'
import { useSesi } from '../../context/SesiContext'
import { labelWaktu } from '../../lib/soal'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { Ikon, TombolIkon, type NamaIkon } from '../../components/ui/Ikon'

// ─── Laci ☰ ─────────────────────────────────────────────────────────────────
// Semua yang BUKAN menyunting satu formulir: pindah/buat formulir, impor, arsip
// sesi dari formulir yang sudah dihapus, dan akun. Halaman utamanya tetap satu.

function ItemLaci({ ikon, label, onClick }: { ikon: NamaIkon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-[calc(100%-0.5rem)] flex items-center gap-4 pl-6 pr-4 h-12 rounded-r-full text-left text-sm text-teks hover:bg-slate-900/5">
      <Ikon nama={ikon} className="w-5 h-5 text-teks-2" />{label}
    </button>
  )
}

export function Laci({ onTutup, onBaru, onImpor, onArsip, onKeluar, membuat }: {
  onTutup: () => void
  onBaru: () => void
  onImpor: () => void
  onArsip: () => void
  onKeluar: () => void
  membuat: boolean
}) {
  const { user } = useAuth()
  const { daftar, aktif, pilihFormulir } = useFormulir()
  const { semuaSesi } = useSesi()
  const arsip = semuaSesi.filter(s => !s.formulirId)
  const adaSesiAktif = new Set(semuaSesi.filter(s => s.status === 'aktif' && s.formulirId).map(s => s.formulirId))

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onTutup} />
      <aside className="laci-masuk absolute left-0 inset-y-0 w-75 max-w-[85%] bg-white shadow-xl flex flex-col">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-garis shrink-0">
          <Ikon nama="dokumen" className="w-8 h-8 text-indigo-600" />
          <span className="text-[22px] text-teks-2">{NAMA_APLIKASI}</span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          <ItemLaci ikon="tambah" label={membuat ? 'Membuat…' : 'Formulir kosong'} onClick={onBaru} />
          <ItemLaci ikon="impor" label="Impor soal" onClick={onImpor} />

          <div className="my-2 border-t border-garis" />
          <p className="px-6 py-2 text-xs font-medium text-teks-2">Formulir</p>
          {daftar.length === 0 && <p className="px-6 py-2 text-sm text-teks-2">Belum ada formulir</p>}
          {daftar.map(f => {
            const dipilih = f.id === aktif?.id
            return (
              <button key={f.id} type="button" onClick={() => { pilihFormulir(f.id); onTutup() }}
                className={`w-[calc(100%-0.5rem)] flex items-center gap-4 pl-6 pr-4 py-2.5 rounded-r-full text-left ${
                  dipilih ? 'bg-indigo-50' : 'hover:bg-slate-900/5'}`}>
                <Ikon nama="dokumen" className="w-5 h-5 text-indigo-600" />
                <span className="flex-1 min-w-0">
                  <span className={`block truncate text-sm ${dipilih ? 'text-indigo-700 font-medium' : 'text-teks'}`}>
                    {f.judul.trim() || 'Formulir tanpa judul'}
                  </span>
                  <span className="block text-xs text-teks-2">{f.jumlahSoal} pertanyaan · {labelWaktu(f.diperbaruiPada)}</span>
                </span>
                {adaSesiAktif.has(f.id) && <span className="w-2 h-2 rounded-full bg-benar shrink-0" title="Ada sesi yang sedang dibuka" />}
              </button>
            )
          })}

          {arsip.length > 0 && (
            <>
              <div className="my-2 border-t border-garis" />
              <ItemLaci ikon="awanSelesai" label={`Arsip sesi (${arsip.length})`} onClick={onArsip} />
            </>
          )}
        </div>

        <div className="border-t border-garis px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium shrink-0">
            {(user?.nama ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-teks truncate">{user?.nama}</p>
            <p className="text-xs text-teks-2 truncate">{user?.email}</p>
          </div>
          <TombolIkon nama="keluar" label="Keluar dari akun" onClick={onKeluar} ukuran="w-5 h-5" />
        </div>
      </aside>
    </div>
  )
}
