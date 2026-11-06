import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.')
}

export const supabase = createClient<Database>(url, key)

/** Unwraps a supabase-js response, throwing its error. */
export function must<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error
  return data
}

/** A write the database turned down: the row isn't the caller's to change, or no longer is. */
export class LockedError extends Error {
  constructor() {
    super('locked')
  }
}

/**
 * Unwraps a write. With `guarded` (a coach editing a client's workout) a refusal becomes a LockedError:
 * a refused insert fails with 42501, while a refused update or delete just matches no rows, so those
 * select their ids for this to count.
 */
export function mustWrite<T>({ data, error }: { data: T; error: { code?: string } | null }, guarded = false): T {
  if (error) throw guarded && error.code === '42501' ? new LockedError() : error
  if (guarded && Array.isArray(data) && data.length === 0) throw new LockedError()
  return data
}
