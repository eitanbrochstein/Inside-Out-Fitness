/** What every push service is asked to show. `url` is where tapping it goes in the app. */
export interface Message {
  title: string
  body: string
  url: string
  /** A newer notification with the same key replaces the older one on the device. */
  collapseKey: string | null
}

export interface WebSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface Device {
  id: string
  platform: 'ios' | 'android' | 'web'
  token: string
  subscription: WebSubscription | null
  apns_sandbox: boolean
}

/**
 * How a send went. `dead`: the token will never work again, so the device is removed. `retry`: a
 * temporary failure worth another try. `sandbox`: an iOS build run from Xcode, which uses Apple's
 * development servers.
 */
export type Outcome = { ok: true; sandbox?: boolean } | { ok: false; dead: boolean; retry: boolean; error: string }

export const failed = (error: string, opts: { dead?: boolean; retry?: boolean } = {}): Outcome => ({
  ok: false,
  dead: opts.dead ?? false,
  retry: opts.retry ?? false,
  error,
})

/** A response status a later try might get past: rate limits and server trouble. */
export const isTemporary = (status: number) => status === 429 || status >= 500

export function env(name: string) {
  const value = Deno.env.get(name)
  return value && value.trim() ? value.trim() : null
}
