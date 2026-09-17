import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// ─── Pemindai QR generik ──────────────────────────────────────────────────────
// Cuma kamera → loop decode → kembalikan TEKS mentah. Apa artinya teks itu
// bukan urusan komponen ini -- pemanggil yang menafsirkan.
//
// jsQR (murni JS, decode per-frame) karena cuma butuh <video> + <canvas> +
// getUserMedia: jalan identik di browser mana pun tanpa plugin native.

export function ScannerQr({ onDeteksi, onTutup }: {
  onDeteksi: (teks: string) => void
  onTutup: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  // Ref, bukan state -- dibaca di loop rAF di luar siklus render React; state
  // basi bisa membuat loop tidak pernah berhenti walau deteksi sudah kena.
  const selesaiRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let batal = false

    function pindai() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || selesaiRef.current) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const hasil = jsQR(frame.data, frame.width, frame.height)
          if (hasil?.data.trim()) {
            selesaiRef.current = true
            onDeteksi(hasil.data.trim())
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(pindai)
    }

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (batal) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        pindai()
      } catch {
        // Izin ditolak, tidak ada kamera, atau browser tidak mendukung -- ketiganya
        // berujung "tidak bisa memindai", jadi pesannya tidak menebak penyebab.
        if (!batal) setError('Tidak bisa mengakses kamera — pastikan izin kamera diberikan, atau masukkan kode manual.')
      }
    })()

    return () => {
      batal = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [onDeteksi])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-white text-sm font-semibold">Arahkan ke kode QR</p>
        <button onClick={onTutup} className="text-white text-sm font-semibold px-3 py-1.5 rounded-lg border border-white/30">
          Tutup
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 max-w-[70vw] max-h-[70vw] border-4 border-white/80 rounded-2xl" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {error && (
        <div className="px-4 py-4 bg-red-900/90 shrink-0">
          <p className="text-white text-sm text-center leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  )
}
