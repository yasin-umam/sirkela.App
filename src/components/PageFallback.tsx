// Fallback Suspense untuk halaman/panel yang di-lazy-load (React.lazy) --
// dipakai seragam di semua titik code-splitting supaya spinner-nya konsisten.
export function PageFallback() {
  return (
    <div className="flex-1 h-full flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )
}
