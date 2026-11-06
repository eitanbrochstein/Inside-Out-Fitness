import { Toaster as Sonner } from 'sonner'

const top = 'max(env(safe-area-inset-top), 12px)'

/** Toasts at the top of the screen. Their glass lives in src/styles/vendor.css. */
export function Toaster() {
  return <Sonner position="top-center" offset={{ top }} mobileOffset={{ top }} />
}
