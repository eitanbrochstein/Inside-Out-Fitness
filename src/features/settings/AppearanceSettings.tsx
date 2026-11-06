import { Check, Monitor } from 'lucide-react'
import type { Profile } from '@/data/types'
import { useUpdateProfile } from '@/data/useProfile'
import {
  ACCENTS,
  type AccentPreference,
  type Appearance,
  applyAppearance,
  normalizeAccent,
  normalizeTheme,
  resolveAccent,
  resolveTheme,
  SYSTEM_THEMES,
  systemPrefersDark,
  THEMES,
  type ThemeId,
  type ThemePreference,
  themeInfo,
} from '@/lib/theme'
import { Card } from '@/ui/Card'
import { cn } from '@/ui/cn'
import { Switch } from '@/ui/Switch'

/**
 * A theme in miniature. It carries the same attributes as <html>, so it renders with the theme's
 * real colours and glass; `accent` previews the accent the reader has chosen on it.
 */
function Preview({ theme, accent, className }: { theme: ThemeId; accent: AccentPreference; className?: string }) {
  const info = themeInfo(theme)
  return (
    <span
      data-theme={info.mode}
      data-scheme={theme}
      data-accent={resolveAccent(accent, theme)}
      className={cn('flex flex-col gap-1.5 overflow-hidden bg-bg bg-(image:--app-bg) p-2.5 text-text', className)}
    >
      <span className="glass-card flex items-center gap-1.5 rounded-[9px] px-2 py-1.5">
        <span className="h-1.5 w-8 rounded-full bg-text/70" />
        <span className="h-1.5 w-4 rounded-full bg-faint/60" />
      </span>
      <span className="glass-tint h-3.5 w-full rounded-full" />
    </span>
  )
}

export function AppearanceSettings({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const current: Appearance = { theme: normalizeTheme(profile.theme), accent: normalizeAccent(profile.accent), glass: profile.glass }

  // The page cross-fades into the new look, and the profile saves it for every device.
  const choose = (patch: Partial<Appearance>) =>
    applyAppearance({ ...current, ...patch }, { animate: true, onApply: () => update.mutate(patch) })

  const themes: { id: ThemePreference; label: string }[] = [{ id: 'system', label: 'System' }, ...THEMES]
  const ownAccent = themeInfo(resolveTheme(current.theme, systemPrefersDark())).accent

  return (
    <Card className="divide-y divide-border">
      <div className="px-4 py-4">
        <div className="text-callout font-semibold">Theme</div>
        <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-2.5">
          {themes.map((t) => {
            const selected = current.theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose({ theme: t.id })}
                className="group flex select-none flex-col gap-1.5 text-left active:scale-[0.97] transition-[scale] duration-150"
              >
                <span
                  className={cn(
                    'relative block overflow-hidden rounded-tile ring-1 ring-border transition-shadow duration-150',
                    selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                  )}
                >
                  {t.id === 'system' ? (
                    <span className="grid grid-cols-2">
                      <Preview theme={SYSTEM_THEMES.light} accent={current.accent} className="pr-1" />
                      <Preview theme={SYSTEM_THEMES.dark} accent={current.accent} className="pl-1" />
                    </span>
                  ) : (
                    <Preview theme={t.id} accent={current.accent} />
                  )}
                  {selected && (
                    <span className="glass-tint absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3" strokeWidth={3.2} />
                    </span>
                  )}
                </span>
                <span className={cn('flex items-center gap-1 px-0.5 text-footnote font-semibold', selected ? 'text-text' : 'text-muted')}>
                  {t.id === 'system' && <Monitor className="size-3.5" />}
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="text-callout font-semibold">Accent</div>
        <div className="mt-0.5 text-footnote text-muted">Buttons, charts and the glow behind every page.</div>
        <div role="radiogroup" aria-label="Accent" className="mt-3 flex flex-wrap gap-3">
          {[{ id: 'theme' as const, label: 'Theme default' }, ...ACCENTS].map((a) => {
            const selected = current.accent === a.id
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={a.label}
                title={a.label}
                onClick={() => choose({ accent: a.id })}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-full transition-[scale,box-shadow] duration-150 active:scale-90',
                  selected && 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--text)]',
                )}
              >
                {/* Theme default shows the theme's own accent, split to say "whichever it is". */}
                <span
                  data-accent={a.id === 'theme' ? ownAccent : a.id}
                  className={cn(
                    'absolute inset-0 rounded-full bg-(image:--accent-gradient) shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]',
                    a.id === 'theme' && '[clip-path:polygon(0_0,100%_0,0_100%)]',
                  )}
                />
                {a.id === 'theme' && <span className="absolute inset-0 rounded-full bg-surface-3 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />}
                {selected && <Check className="relative size-4 text-on-accent" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-4">
        <div className="flex-1">
          <div className="text-callout font-semibold">Glass</div>
          <div className="mt-0.5 text-footnote text-muted">Translucent, lit surfaces. Turn off for solid ones.</div>
        </div>
        <Switch label="Glass" checked={current.glass} onChange={(glass) => choose({ glass })} />
      </div>
    </Card>
  )
}
