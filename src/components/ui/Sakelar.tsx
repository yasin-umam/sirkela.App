/** Sakelar Material (setelan Google Form): lintasan tipis, kenop bundar berbayang. */
export function Sakelar({ aktif, onUbah, disabled, label }: {
  aktif: boolean
  onUbah: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button type="button" role="switch" aria-checked={aktif} aria-label={label} disabled={disabled}
      onClick={() => onUbah(!aktif)}
      className="relative w-10 h-6 shrink-0 disabled:opacity-50">
      <span className={`absolute left-0.5 right-0.5 top-1/2 -translate-y-1/2 h-3.5 rounded-full transition-colors ${
        aktif ? 'bg-indigo-300' : 'bg-slate-300'}`} />
      <span className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all ${
        aktif ? 'left-4.5 bg-indigo-600' : 'left-0 bg-white'}`} />
    </button>
  )
}
