import { cn } from './cn'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full', checked ? 'glass-tint' : 'glass-field')}
    >
      <span
        className={cn(
          'absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.06)] transition-transform duration-250 ease-spring',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
