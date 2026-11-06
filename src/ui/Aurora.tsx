/** Slow-drifting glows of the accent behind a page (sign-in only: it's the one place with nothing else to look at). */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-1 overflow-hidden">
      <span className="absolute -top-[15%] -left-[10%] size-[55vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_38%,transparent),transparent)] opacity-70 blur-[60px]" />
      <span className="absolute -right-[15%] -bottom-[20%] size-[60vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent-2)_30%,transparent),transparent)] opacity-70 blur-[60px] [animation-direction:alternate-reverse] [animation-duration:30s]" />
      <span className="absolute top-[35%] left-[40%] size-[35vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)] opacity-70 blur-[50px] [animation-duration:18s]" />
    </div>
  )
}
