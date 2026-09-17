export type HasilBagikan = 'terkirim' | 'dibatalkan' | 'tidak-didukung'

/** Share sheet sistem (WhatsApp dst). Pemanggil menyiapkan cadangan clipboard. */
export async function bagikanTeks(judul: string, teks: string, url?: string): Promise<HasilBagikan> {
  if (!navigator.share) return 'tidak-didukung'
  try {
    await navigator.share({ title: judul, text: teks, url })
    return 'terkirim'
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dibatalkan'
    return 'tidak-didukung'
  }
}
