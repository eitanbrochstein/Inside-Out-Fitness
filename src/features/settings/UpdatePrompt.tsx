import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Offers a reload when a new version of the app has been downloaded. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast('Update available', {
      description: 'A new version of the app is ready.',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
