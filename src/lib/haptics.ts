/** A light tick on devices that support vibration (Android). iOS Safari ignores it. */
export function tick() {
  try {
    navigator.vibrate?.(8)
  } catch {
    // unsupported
  }
}

/** A double pulse for a personal record. */
export function success() {
  try {
    navigator.vibrate?.([10, 50, 22])
  } catch {
    // unsupported
  }
}
