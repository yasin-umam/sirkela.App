/** Sakelar: lintasan penuh, kenop putih. `jingga` untuk kunci layar (warna waktu/kunci). */
export function Sakelar({ aktif, onUbah, disabled, label, warna = 'biru' }: {
  aktif: boolean
  onUbah: (v: boolean) => void
  disabled?: boolean
  label: string
  warna?: 'biru' | 'jingga'
}) {
  const nyala = warna === 'jingga' ? 'bg-jingga' : 'bg-biru'
  return (
    <button type="button" role="switch" aria-checked={aktif} aria-label={label} disabled={disabled}
      onClick={() => onUbah(!aktif)}
      className={`relative w-12 h-7 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        aktif ? nyala : 'bg-pinggir'}`}>
      <span className={`absolute top-0.75 w-5.5 h-5.5 rounded-full bg-white transition-all ${
        aktif ? 'left-5.75' : 'left-0.75'}`} />
    </button>
  )
}
