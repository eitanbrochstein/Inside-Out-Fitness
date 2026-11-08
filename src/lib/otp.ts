/** Digits in an emailed sign-in code (otp_length in supabase/config.toml and the dashboard). */
export const CODE_LENGTH = 6

/** Seconds before another code can be sent: the hosted project's minimum gap between emails to one address. */
export const RESEND_SECONDS = 60

/** Digits only, at most six, so a pasted "123 456" or "Code: 123456" still fits. */
export const cleanCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_LENGTH)

const AUTH_ERRORS: Record<string, string> = {
  otp_expired: 'That code is wrong or has expired. Check it, or send a new one.',
  otp_disabled: 'No account uses that email. Check it, or create an account.',
  over_email_send_rate_limit: 'Too many codes sent. Wait a minute, then try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  email_address_invalid: "That email address doesn't look right.",
  signup_disabled: "New accounts can't be created right now.",
}

/** Plain wording for a supabase-js auth error, chosen by its code. */
export function authErrorMessage(error: { message: string; code?: string; status?: number; name?: string }) {
  // supabase-js reports a request that never reached the server as AuthRetryableFetchError, status 0.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return "Can't reach the server. Check your connection and try again."
  }
  return (error.code && AUTH_ERRORS[error.code]) || error.message
}
