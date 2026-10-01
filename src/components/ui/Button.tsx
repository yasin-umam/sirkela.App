import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` biru terisi (aksi utama layar) · `secondary` berbingkai (aksi
   * sampingan) · `teks` biru tanpa latar (aksi sekunder di dialog) · `ghost`
   * netral tanpa latar (Batal) · `danger` jingga terisi (tombol AKSI di dialog
   * konfirmasi yang tidak bisa dibatalkan) · `danger-garis` jingga berbingkai
   * (pemicu aksi berbahaya di layar, mis. "Akhiri sesi" -- konfirmasinya baru
   * yang terisi).
   */
  variant?: 'primary' | 'secondary' | 'teks' | 'ghost' | 'danger' | 'danger-garis'
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
  const base = 'inline-flex items-center justify-center font-bold rounded-xl transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-biru text-white hover:bg-biru-gelap',
    secondary: 'bg-white text-tinta border-[1.5px] border-pinggir-2 hover:bg-isian',
    teks: 'bg-transparent text-biru hover:bg-biru-tint',
    ghost: 'bg-transparent text-tinta-2 hover:bg-garis-2',
    danger: 'bg-jingga text-white hover:bg-jingga-gelap',
    'danger-garis': 'bg-white text-jingga-gelap border-[1.5px] border-jingga hover:bg-jingga-tipis',
  }

  // Tinggi sentuh: md 48px, lg 56px. `sm` 40px cuma untuk baris padat (bilah alat,
  // tombol di dalam baris daftar) -- aksi utama sebuah layar tidak memakainya.
  const sizes = {
    sm: 'h-10 text-sm px-3.5 gap-1.5',
    md: 'h-12 text-[15px] px-5 gap-2',
    lg: 'h-14 text-base px-6 gap-2 rounded-[14px]',
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
