import type { InputHTMLAttributes } from 'react'

// Kolom isian "Lembar Jawab": kotak putih 48px, bingkai 1.5px, berubah jadi biru
// tebal saat fokus (seperti kolom yang sedang diisi pada lembar jawab).
export function Input({ label, error, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-bold text-tinta">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-12 px-4 rounded-xl border-[1.5px] bg-white text-tinta
          placeholder:text-teks-3
          focus:outline-none focus:border-biru focus:ring-2 focus:ring-biru/20
          transition-colors duration-150
          ${error ? 'border-jingga focus:border-jingga focus:ring-jingga/20' : 'border-pinggir-2'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-medium text-jingga-gelap">{error}</p>}
    </div>
  )
}
