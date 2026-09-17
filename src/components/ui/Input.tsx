import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

// Garis bawah polos ala field Google Form -- bukan kotak penuh -- menebal &
// berwarna saat fokus lewat satu border-bottom, tanpa kotak di sekelilingnya.
export function Input({ label, error, className = '', id, ...props }: InputProps) {
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
        className={`w-full px-1 pt-2 pb-2.5 rounded-none border-0 border-b-2 bg-transparent text-slate-800 text-sm
          placeholder:text-slate-400
          border-slate-300 focus:outline-none focus:border-indigo-600
          transition-colors duration-150
          ${error ? 'border-red-400 focus:border-red-500' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
