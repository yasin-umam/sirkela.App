import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Bentuk tombol Luang: `primary` terisi indigo, `secondary` indigo pucat,
   * `teks` indigo tanpa latar (aksi sekunder di dialog), `ghost` abu-abu,
   * `danger` merah untuk aksi yang tidak bisa dibatalkan.
   */
  variant?: 'primary' | 'secondary' | 'teks' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700',
    secondary: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    teks: 'bg-transparent text-indigo-600 hover:bg-indigo-50',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white shadow-sm shadow-red-200 hover:bg-red-600',
  }

  const sizes = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3.5 gap-2',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
