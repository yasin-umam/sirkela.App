import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Bentuk tombol Google Form: `primary` terisi ungu ("Kirim"), `secondary`
   * bergaris, `teks` ungu tanpa latar ("Kosongkan formulir", "Batal" di dialog),
   * `ghost` abu-abu, `danger` merah untuk aksi yang tidak bisa dibatalkan.
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
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:bg-indigo-800',
    secondary: 'bg-white text-indigo-600 border border-garis hover:bg-indigo-50 active:bg-indigo-100',
    teks: 'bg-transparent text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100',
    ghost: 'bg-transparent text-teks-2 hover:bg-slate-900/5 active:bg-slate-900/10',
    danger: 'bg-salah text-white hover:shadow-md hover:brightness-95',
  }

  const sizes = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-6 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2',
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
