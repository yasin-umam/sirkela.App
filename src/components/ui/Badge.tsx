import type { ReactNode } from 'react'

type BadgeColor = 'indigo' | 'green' | 'yellow' | 'red' | 'slate'

interface BadgeProps {
  color?: BadgeColor
  children: ReactNode
}

const colors: Record<BadgeColor, string> = {
  indigo: 'bg-indigo-100 text-indigo-700',
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function Badge({ color = 'slate', children }: BadgeProps) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors[color]}`}>
      {children}
    </span>
  )
}
