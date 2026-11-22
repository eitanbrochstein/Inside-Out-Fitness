import { toast } from 'sonner'
import { enablePush, pushOnHere, pushPermission, pushSupport } from '@/lib/push'

let offered = false

/**
 * After someone gives a workout a time: if this device could remind them but isn't set up, offer once a
 * session. Permission is only asked for if they tap Turn on.
 */
export async function offerReminders() {
  if (offered) return
  const support = pushSupport()
  if (support !== 'native' && support !== 'web') return
  if ((await pushPermission()) !== 'prompt' || (await pushOnHere())) return
  offered = true
  toast('Get a reminder before it starts?', {
    action: {
      label: 'Turn on',
      onClick: () => {
        enablePush()
          .then((p) => p === 'granted' && toast.success('Notifications are on', { description: 'Change what you get in Settings.' }))
          .catch(() => toast.error("Couldn't turn on notifications"))
      },
    },
    duration: 8000,
  })
}
