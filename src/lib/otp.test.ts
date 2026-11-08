import { expect, test } from 'vitest'
import { authErrorMessage, cleanCode } from './otp'

test('cleanCode keeps up to six digits', () => {
  expect(cleanCode('123456')).toBe('123456')
  expect(cleanCode('123 456')).toBe('123456')
  expect(cleanCode('Code: 123-456')).toBe('123456')
  expect(cleanCode('1234567')).toBe('123456')
  expect(cleanCode('12a')).toBe('12')
  expect(cleanCode('')).toBe('')
})

test('authErrorMessage words known codes plainly', () => {
  expect(authErrorMessage({ message: 'Token has expired or is invalid', code: 'otp_expired', status: 403 })).toMatch(/wrong or has expired/)
  expect(authErrorMessage({ message: 'Signups not allowed for otp', code: 'otp_disabled', status: 422 })).toMatch(/No account uses that email/)
  expect(authErrorMessage({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 })).toMatch(/Too many codes/)
})

test('authErrorMessage explains a request that never arrived', () => {
  expect(authErrorMessage({ message: 'Load failed', name: 'AuthRetryableFetchError', status: 0 })).toMatch(/Can't reach the server/)
})

test('authErrorMessage falls back to the server message', () => {
  expect(authErrorMessage({ message: 'Something new', code: 'unknown_code', status: 400 })).toBe('Something new')
  expect(authErrorMessage({ message: 'No code at all' })).toBe('No code at all')
})
