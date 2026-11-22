/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** The live website's address. Required for native builds, see vite.config.ts. */
  readonly VITE_APP_URL?: string
  /** Web push's public (VAPID) key. Without it the website offers no notifications; the apps don't need it. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
