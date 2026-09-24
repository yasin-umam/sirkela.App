import type { InputHTMLAttributes } from 'react'

// Kolom isian Luang: kotak penuh bersudut 12px dengan cincin indigo saat fokus.
export function Input({ label, error, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3 rounded-xl border bg-white text-slate-800 text-sm
          placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          transition-all duration-150
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
