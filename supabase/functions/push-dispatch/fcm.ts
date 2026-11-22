// Firebase Cloud Messaging (HTTP v1), for Android. Docs:
// https://firebase.google.com/docs/cloud-messaging/send-message
import { importPKCS8, SignJWT } from 'jose'
import { env, failed, isTemporary, type Message, type Outcome } from './types.ts'

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

let account: ServiceAccount | null | undefined
let cached: { token: string; expires: number } | null = null

function serviceAccount() {
  if (account === undefined) {
    const raw = env('FCM_SERVICE_ACCOUNT')
    try {
      account = raw ? (JSON.parse(raw) as ServiceAccount) : null
    } catch {
      account = null
    }
  }
  return account
}

/** An OAuth access token for FCM, from the service account's key (cached until just before it expires). */
async function accessToken(sa: ServiceAccount) {
  if (cached && Date.now() < cached.expires - 60_000) return cached.token
  const key = await importPKCS8(sa.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 }
  return json.access_token
}

export async function sendFcm(token: string, msg: Message): Promise<Outcome> {
  const sa = serviceAccount()
  if (!sa) return failed('FCM is not configured')

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken(sa)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: { url: msg.url },
        android: {
          priority: 'high',
          ...(msg.collapseKey ? { collapse_key: msg.collapseKey } : {}),
          notification: { icon: 'ic_stat_notify', sound: 'default', ...(msg.collapseKey ? { tag: msg.collapseKey } : {}) },
        },
      },
    }),
  })
  if (res.ok) return { ok: true }

  const body = (await res.json().catch(() => null)) as {
    error?: { status?: string; message?: string; details?: { errorCode?: string }[] }
  } | null
  const code = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status ?? ''
  const error = `FCM ${res.status} ${code} ${body?.error?.message ?? ''}`.trim()
  // An app uninstalled, or a token that was never valid.
  if (res.status === 404 || code === 'UNREGISTERED' || (code === 'INVALID_ARGUMENT' && /registration token/i.test(error))) {
    return failed(error, { dead: true })
  }
  return failed(error, { retry: isTemporary(res.status) || code === 'UNAVAILABLE' || code === 'INTERNAL' })
}
