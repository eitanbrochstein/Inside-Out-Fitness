import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNative } from './native'

/** A light tick. In a browser only Android vibrates; iOS Safari ignores it. */
export function tick() {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    return
  }
  try {
    navigator.vibrate?.(8)
  } catch {
    // unsupported
  }
}

/** A double pulse for a personal record. */
export function success() {
  if (isNative) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => {})
    return
  }
  try {
    navigator.vibrate?.([10, 50, 22])
  } catch {
    // unsupported
  }
}

/* Selection ticks for a finger sliding across choices (the tab bar's lens). Native only: a browser
   buzz on every step would be too much. */
export function selectionStart() {
  if (isNative) Haptics.selectionStart().catch(() => {})
}
export function selectionChanged() {
  if (isNative) Haptics.selectionChanged().catch(() => {})
}
export function selectionEnd() {
  if (isNative) Haptics.selectionEnd().catch(() => {})
}
