// Apple Push Notification service, with a token-based (.p8) key. Docs:
// https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
import { importPKCS8, SignJWT } from 'jose'
import { env, failed, isTemporary, type Message, type Outcome } from './types.ts'

const PRODUCTION = 'https://api.push.apple.com'
const SANDBOX = 'https://api.sandbox.push.apple.com'

// Apple wants a provider token no older than an hour and no newer than 20 minutes between refreshes.
let cached: { jwt: string; at: number } | null = null

async function providerToken(keyId: string, teamId: string, privateKey: string) {
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.jwt
  // Secrets set from a shell often arrive with literal "\n"s.
  const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'ES256')
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId }).setIssuer(teamId).setIssuedAt().sign(key)
  cached = { jwt, at: Date.now() }
  return jwt
}

export async function sendApns(token: string, msg: Message, sandbox: boolean): Promise<Outcome> {
  const keyId = env('APNS_KEY_ID')
  const teamId = env('APNS_TEAM_ID')
  const privateKey = env('APNS_PRIVATE_KEY')
  const topic = env('APNS_BUNDLE_ID') ?? 'com.insideouttraining.app'
  if (!keyId || !teamId || !privateKey) return failed('APNs is not configured')

  const jwt = await providerToken(keyId, teamId, privateKey)
  const send = async (host: string) => {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        ...(msg.collapseKey ? { 'apns-collapse-id': msg.collapseKey.slice(0, 64) } : {}),
      },
      body: JSON.stringify({
        aps: {
          alert: { title: msg.title, body: msg.body },
          sound: 'default',
          ...(msg.collapseKey ? { 'thread-id': msg.collapseKey } : {}),
        },
        // Outside `aps`, so the app reads it from the notification's data when it's tapped.
        url: msg.url,
      }),
    })
    const reason = res.ok ? null : ((await res.json().catch(() => null)) as { reason?: string } | null)?.reason ?? `HTTP ${res.status}`
    return { status: res.status, reason }
  }

  const first = await send(sandbox ? SANDBOX : PRODUCTION)
  if (first.status === 200) return { ok: true, sandbox }
  // A token from a build run in Xcode only works on the development servers.
  if (!sandbox && first.reason === 'BadDeviceToken') {
    const second = await send(SANDBOX)
    if (second.status === 200) return { ok: true, sandbox: true }
    return classify(second)
  }
  return classify(first)
}

function classify({ status, reason }: { status: number; reason: string | null }): Outcome {
  const error = `APNs ${status} ${reason ?? ''}`.trim()
  if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic') {
    return failed(error, { dead: true })
  }
  return failed(error, { retry: isTemporary(status) })
}
