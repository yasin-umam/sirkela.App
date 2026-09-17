import { useState } from 'react'
import { LapisMengambang } from './LapisMengambang'

// ─── Kontrol zoom kartu soal murid ────────────────────────────────────────────
// Hook ini cuma menyimpan angkanya; KerjakanSesi menerapkannya sebagai CSS
// `zoom` di wadah terluar (isinya teks/kotak biasa yang tingginya mengikuti isi).
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2
const ZOOM_STEP = 0.2
const ZOOM_DEFAULT = 1

export function useZoomKontrol() {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  return {
    zoom,
    zoomIn: () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))),
    zoomOut: () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))),
    reset: () => setZoom(ZOOM_DEFAULT),
    bisaZoomIn: zoom < ZOOM_MAX,
    bisaZoomOut: zoom > ZOOM_MIN,
    default: zoom === ZOOM_DEFAULT,
  }
}

function TombolZoom({ zoom, zoomIn, zoomOut, reset, bisaZoomIn, bisaZoomOut, default: sudahDefault }: ReturnType<typeof useZoomKontrol>) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white shadow-md border border-garis p-1">
      <button
        type="button"
        onClick={zoomIn}
        disabled={!bisaZoomIn}
        title="Perbesar"
        className="w-8 h-8 rounded-full flex items-center justify-center text-teks-2 font-bold text-base leading-none active:bg-slate-100 disabled:opacity-30 disabled:active:bg-transparent transition-colors"
      >
        +
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={sudahDefault}
        title="Atur ulang zoom"
        className="w-8 h-8 flex items-center justify-center text-[10px] font-semibold text-teks-2 active:bg-slate-100 rounded-lg disabled:active:bg-transparent transition-colors"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={zoomOut}
        disabled={!bisaZoomOut}
        title="Perkecil"
        className="w-8 h-8 rounded-full flex items-center justify-center text-teks-2 font-bold text-base leading-none active:bg-slate-100 disabled:opacity-30 disabled:active:bg-transparent transition-colors"
      >
        −
      </button>
    </div>
  )
}

// Positioning dipegang LapisMengambang: tepi kanannya sejajar KARTU 430px,
// bukan jendela browser (lihat alasannya di sana).
export function TombolZoomMengambang(props: ReturnType<typeof useZoomKontrol>) {
  return (
    <LapisMengambang posisi="inset-x-0 bottom-4">
      <div className="pointer-events-auto">
        <TombolZoom {...props} />
      </div>
    </LapisMengambang>
  )
}
