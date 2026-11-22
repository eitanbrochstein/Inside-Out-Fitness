// Web push (VAPID), for the website and the installed PWA. The service worker (sw/sw.ts) shows it.
// web-push encrypts the payload and signs the request; fetch sends it, so nothing leans on Node's https.
import webpush from 'web-push'
import { env, failed, isTemporary, type Message, type Outcome, type WebSubscription } from './types.ts'

export async function sendWebPush(subscription: WebSubscription | null, msg: Message): Promise<Outcome> {
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return failed('No web push subscription', { dead: true })
  }
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  const subject = env('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) return failed('Web push is not configured')

  const request = webpush.generateRequestDetails(
    subscription,
    JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.collapseKey }),
    { TTL: 60 * 60 * 12, urgency: 'high', vapidDetails: { subject, publicKey, privateKey } },
  )
  const res = await fetch(request.endpoint, { method: request.method, headers: request.headers, body: request.body })
  if (res.ok) return { ok: true }

  const error = `Web push ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`.trim()
  // The browser dropped the subscription (unsubscribed, cleared site data, or expired).
  if (res.status === 404 || res.status === 410) return failed(error, { dead: true })
  return failed(error, { retry: isTemporary(res.status) })
}
