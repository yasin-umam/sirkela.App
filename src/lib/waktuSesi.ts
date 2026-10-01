import { useEffect, useState } from 'react'

/**
 * Sisa detik sebuah sesi yang SUDAH dimulai, diperbarui tiap detik. null =
 * belum dimulai (belum ada tenggat).
 *
 * Tenggat diturunkan dari mulai_pada + durasi -- aturan yang sama dengan
 * sesi_tenggat() di DB -- dan dihitung ulang dari tenggat tiap tick, BUKAN
 * dikurangi 1: browser men-throttle setInterval saat tab di-background.
 */
export function useSisaDetik(mulaiPada: string | null, durasiMenit: number): number | null {
  const tenggatMs = mulaiPada ? new Date(mulaiPada).getTime() + durasiMenit * 60_000 : null
  const [, tick] = useState(0)
  useEffect(() => {
    if (tenggatMs == null) return
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [tenggatMs])
  return tenggatMs == null ? null : Math.max(0, Math.round((tenggatMs - Date.now()) / 1000))
}

/** 125 -> "02:05". */
export function menitDetik(detik: number): string {
  return `${String(Math.floor(detik / 60)).padStart(2, '0')}:${String(detik % 60).padStart(2, '0')}`
}
