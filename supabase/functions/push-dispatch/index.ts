// Sends the notifications the database has queued (public.notifications) to every device their person
// has. The database calls this once a minute when something is waiting (run_push_jobs, through pg_net),
// with a shared secret; deploy it with --no-verify-jwt. See README → Notifications for its secrets.
import { createClient } from '@supabase/supabase-js'
import { sendApns } from './apns.ts'
import { sendFcm } from './fcm.ts'
import { env, failed, type Device, type Message, type Outcome } from './types.ts'
import { sendWebPush } from './webpush.ts'

interface Queued {
  id: string
  user_id: string
  title: string
  body: string
  url: string
  collapse_key: string | null
  devices: Device[]
}

const BATCH = 100
const MAX_BATCHES = 5

Deno.serve(async (req) => {
  const secret = env('PUSH_DISPATCH_SECRET')
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let sent = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db.rpc('claim_push_batch', { p_limit: BATCH })
    if (error) return Response.json({ error: error.message, sent }, { status: 500 })
    const batch = (data ?? []) as Queued[]
    if (!batch.length) break

    const results = await Promise.all(batch.map(deliver))
    const done = await db.rpc('complete_push', { p_results: results })
    if (done.error) return Response.json({ error: done.error.message, sent }, { status: 500 })

    sent += batch.length
    if (batch.length < BATCH) break
  }
  return Response.json({ sent })
})

/** One notification to each of its person's devices, summed up for complete_push. */
async function deliver(n: Queued) {
  const msg: Message = { title: n.title, body: n.body, url: n.url, collapseKey: n.collapse_key }
  const outcomes = await Promise.all(n.devices.map(async (d) => ({ device: d, outcome: await sendTo(d, msg) })))

  const delivered = outcomes.some((o) => o.outcome.ok)
  const errors = outcomes.flatMap(({ device, outcome }) => (outcome.ok ? [] : [`${device.platform}: ${outcome.error}`]))
  return {
    id: n.id,
    dead: outcomes.filter((o) => !o.outcome.ok && o.outcome.dead).map((o) => o.device.id),
    sandbox: outcomes.filter((o) => o.outcome.ok && o.outcome.sandbox && !o.device.apns_sandbox).map((o) => o.device.id),
    // Worth another go only if it reached no device and something failed for a passing reason.
    retry: !delivered && outcomes.some((o) => !o.outcome.ok && o.outcome.retry),
    error: errors.length ? errors.join('; ').slice(0, 500) : null,
  }
}

async function sendTo(device: Device, msg: Message): Promise<Outcome> {
  try {
    switch (device.platform) {
      case 'ios':
        return await sendApns(device.token, msg, device.apns_sandbox)
      case 'android':
        return await sendFcm(device.token, msg)
      case 'web':
        return await sendWebPush(device.subscription, msg)
    }
  } catch (e) {
    return failed(`${device.platform}: ${(e as Error).message ?? e}`, { retry: true })
  }
}
