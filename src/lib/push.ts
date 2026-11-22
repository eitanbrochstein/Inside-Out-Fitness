// Push notifications on this device. The apps register with APNs (iOS) or FCM (Android) through
// @capacitor/push-notifications; the website subscribes through its service worker (web push). Either
// way the device lands in push_devices via register_push_device, and the server decides what to send
// and when (supabase/migrations/…_notifications.sql). Nothing here ever asks for permission on its own:
// only enablePush, from a tap.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import type { Json } from './database.types'
import { isNative } from './native'
import { supabase } from './supabase'

/** `ios-needs-install`: an iPhone browser tab. iOS only gives web push to sites added to the Home Screen. */
export type PushSupport = 'native' | 'web' | 'ios-needs-install' | 'unsupported'
export type PushPermission = 'granted' | 'denied' | 'prompt'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const TOKEN_KEY = 'push-token'
const OFF_KEY = 'push-off' // turned off on this device from Settings, so launches don't re-register it

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(): PushSupport {
  if (isNative) return 'native'
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'ios-needs-install'
  return 'PushManager' in window ? 'web' : 'unsupported'
}

export async function pushPermission(): Promise<PushPermission> {
  if (isNative) {
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  }
  if (!('Notification' in window)) return 'denied'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

// ---------- what this device remembers ----------

async function getItem(key: string) {
  if (isNative) return (await Preferences.get({ key })).value
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

async function setItem(key: string, value: string | null) {
  if (isNative) {
    await (value == null ? Preferences.remove({ key }) : Preferences.set({ key, value }))
    return
  }
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the device is still registered, it just can't be removed on sign-out.
  }
}

/** Whether this device is registered and not turned off here. */
export async function pushOnHere() {
  return !!(await getItem(TOKEN_KEY)) && !(await getItem(OFF_KEY))
}

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

async function saveDevice(platform: 'ios' | 'android' | 'web', token: string, subscription?: Json) {
  const { error } = await supabase.rpc('register_push_device', {
    p_platform: platform,
    p_token: token,
    p_subscription: subscription,
    p_timezone: timezone(),
  })
  if (error) throw error
  await setItem(TOKEN_KEY, token)
}

// ---------- the apps ----------

let listening: Promise<void> | null = null
let waiting: { resolve: () => void; reject: (e: unknown) => void } | null = null

/** The token arrives as an event, after register(): on the first time and on every launch after. */
function listenForToken() {
  listening ??= (async () => {
    await PushNotifications.addListener('registration', async ({ value }) => {
      const done = waiting
      waiting = null
      try {
        await saveDevice(Capacitor.getPlatform() === 'ios' ? 'ios' : 'android', value)
        done?.resolve()
      } catch (e) {
        done?.reject(e)
      }
    })
    await PushNotifications.addListener('registrationError', ({ error }) => {
      waiting?.reject(new Error(error))
      waiting = null
    })
  })()
  return listening
}

async function registerNative() {
  await listenForToken()
  await new Promise<void>((resolve, reject) => {
    // Without the push capability (or offline) neither event may come.
    const timer = window.setTimeout(() => reject(new Error('push_register_timeout')), 15_000)
    waiting = {
      resolve: () => (window.clearTimeout(timer), resolve()),
      reject: (e) => (window.clearTimeout(timer), reject(e)),
    }
    PushNotifications.register().catch(waiting.reject)
  })
}

// ---------- the website ----------

function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i])

/** The service worker only runs in a production build (`pnpm build && pnpm preview`, or the live site). */
async function serviceWorker() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('no_service_worker')), 8000)),
  ])
}

async function registerWeb() {
  const registration = await serviceWorker()
  const key = keyBytes(VAPID_PUBLIC_KEY!)
  let subscription = await registration.pushManager.getSubscription()
  // A subscription made with an earlier key can't receive pushes signed with this one.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await saveDevice('web', subscription.endpoint, subscription.toJSON() as Json)
}

// ---------- turning it on and off ----------

/** Asks for permission (call it from a tap) and registers this device. */
export async function enablePush(): Promise<PushPermission> {
  let permission: PushPermission
  if (isNative) {
    let { receive } = await PushNotifications.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await PushNotifications.requestPermissions()).receive
    permission = receive === 'granted' ? 'granted' : 'denied'
  } else {
    const result = await Notification.requestPermission()
    permission = result === 'default' ? 'prompt' : result
  }
  if (permission !== 'granted') return permission
  await setItem(OFF_KEY, null)
  await (isNative ? registerNative() : registerWeb())
  return 'granted'
}

/** On launch: keeps an already-allowed device registered (tokens change) and its time zone current. */
export async function syncPush() {
  const support = pushSupport()
  if (support !== 'native' && support !== 'web') return
  if ((await getItem(OFF_KEY)) || (await pushPermission()) !== 'granted') return
  await (isNative ? registerNative() : registerWeb())
}

/** Stops notifications to this device for this account. Before signing out, while the delete is still allowed. */
export async function forgetThisDevice() {
  const token = await getItem(TOKEN_KEY)
  if (token) await supabase.from('push_devices').delete().eq('token', token)
  await setItem(TOKEN_KEY, null)
}

/** "Turn off on this device" in Settings: forgotten, and not re-registered on the next launch. */
export async function disablePushHere() {
  await forgetThisDevice()
  await setItem(OFF_KEY, '1')
}

// ---------- tapping one ----------

/** Only paths inside the app, never another site. */
const inAppPath = (url: unknown) => (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null)

/** Calls `open` with the in-app path of a tapped notification. Returns a cleanup. */
export function onNotificationOpen(open: (path: string) => void) {
  if (isNative) {
    const handle = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const path = inAppPath((notification.data as { url?: unknown } | undefined)?.url)
      if (path) open(path)
    })
    return () => void handle.then((h) => h.remove())
  }
  if (!('serviceWorker' in navigator)) return () => {}
  const onMessage = (e: MessageEvent) => {
    const path = e.data?.type === 'navigate' ? inAppPath(e.data.url) : null
    if (path) open(path)
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
