import { useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Ref, TextareaHTMLAttributes } from 'react'

/**
 * Textarea yang tingginya mengikuti isi, seperti kolom pertanyaan Google Form:
 * tidak ada scrollbar di dalam kartu, dan satu baris tetap terlihat satu baris.
 */
export function TeksOtomatis({ ref, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>
}) {
  const dalam = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => dalam.current!)

  useLayoutEffect(() => {
    const el = dalam.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return <textarea ref={dalam} rows={1} value={value} {...props} />
}
