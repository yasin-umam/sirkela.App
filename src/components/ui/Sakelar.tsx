/** Sakelar Luang: lintasan penuh, kenop putih berbayang. */
export function Sakelar({ aktif, onUbah, disabled, label, warna = 'indigo' }: {
  aktif: boolean
  onUbah: (v: boolean) => void
  disabled?: boolean
  label: string
  /** `amber` untuk kunci layar -- warna peringatan yang sama dengan kartunya. */
  warna?: 'indigo' | 'amber'
}) {
  const nyala = warna === 'amber' ? 'bg-amber-500' : 'bg-indigo-600'
  return (
    <button type="button" role="switch" aria-checked={aktif} aria-label={label} disabled={disabled}
      onClick={() => onUbah(!aktif)}
      className={`relative w-10 h-6 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        aktif ? nyala : 'bg-slate-200'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
        aktif ? 'left-4.5' : 'left-0.5'}`} />
    </button>
  )
}
