import { App } from '@capacitor/app'
import { Clipboard } from '@capacitor/clipboard'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'

/** True inside the iOS and Android apps, false in a browser. */
export const isNative = Capacitor.isNativePlatform()

export const canShare = () => isNative || 'share' in navigator

/** Opens the share sheet. Rejects if it's dismissed. */
export async function shareLink(content: { title: string; text: string; url: string }) {
  if (isNative) await Share.share(content)
  else await navigator.share(content)
}

/** Android's web view can refuse navigator.clipboard, so the apps use the native clipboard. */
export async function copyText(text: string) {
  if (isNative) await Clipboard.write({ string: text })
  else await navigator.clipboard.writeText(text)
}

// Before Chromium 140 Android's web view can't draw behind the system bars, so Capacitor insets the page
// and the bars sit on the window's fixed dark background (android/app/src/main/res/values/styles.xml).
const barsOnDarkWindow = Number(/Android.*Chrome\/(\d+)/.exec(navigator.userAgent)?.[1]) < 140

/** Matches the status bar's text to the theme on <html>. Browsers read the meta tags instead. */
export function syncStatusBar() {
  if (!isNative) return
  const light = document.documentElement.dataset.theme === 'light' && !barsOnDarkWindow
  const style = light ? SystemBarsStyle.Light : SystemBarsStyle.Dark
  SystemBars.setStyle({ style }).catch(() => {})
}

/** Keeps the sign-in in native storage: a phone low on space can clear a web view's localStorage. */
export const nativeAuthStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: (key: string, value: string) => Preferences.set({ key, value }),
  removeItem: (key: string) => Preferences.remove({ key }),
}

/** Android's back button: closes an open sheet, then goes back a page, then leaves the app. */
export function installBackButton() {
  if (Capacitor.getPlatform() !== 'android') return
  App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[data-vaul-drawer][data-state="open"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    } else if (canGoBack) {
      history.back()
    } else {
      App.exitApp()
    }
  })
}
