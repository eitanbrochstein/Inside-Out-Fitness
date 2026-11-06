import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

/** Textarea that grows with its content. */
export function AutoTextarea({ className, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn('block w-full resize-none overflow-hidden bg-transparent outline-none', className)}
      {...props}
    />
  )
}
