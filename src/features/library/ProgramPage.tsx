import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Copy, Ellipsis, Eraser, Play, Plus, Send } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { AddWorkoutSheet } from '@/features/plan/AddWorkoutSheet'
import { StartProgramSheet } from '@/features/plan/StartProgramSheet'
import { WorkoutActionsSheet } from '@/features/workout/Sheets'
import { describeWorkout } from '@/features/workouts/describe'
import { useOpenBlank } from '@/features/workouts/useNewWorkout'
import { keys } from '@/data/keys'
import type { ProgramDay, ProgramDoc } from '@/data/types'
import { useProfile } from '@/data/useProfile'
import { useProgram, useProgramActions } from '@/data/usePrograms'
import { useTemplates } from '@/data/useWorkouts'
import { programDayLabel, weekdayName } from '@/lib/calendar'
import { plural } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAutosave, useDraft } from '@/lib/useAutosave'
import { BottomBar } from '@/ui/BottomBar'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { cn } from '@/ui/cn'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { ListGroup, ListRow } from '@/ui/ListRow'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { Skeleton } from '@/ui/Skeleton'

export function ProgramPage() {
  const { id } = useParams()
  return <ProgramLoader key={id} id={id!} />
}

function ProgramLoader({ id }: { id: string }) {
  const { data: program, isPending } = useProgram(id)
  if (isPending) {
    return (
      <Page>
        <PageHeader back title={<Skeleton className="h-8 w-56 rounded-lg" />} />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[60px]" />
          ))}
        </div>
      </Page>
    )
  }
  if (!program) {
    return (
      <Page>
        <PageHeader back title="Program not found" />
        <EmptyState icon={<CalendarRange />} title="Not found">
          This program was deleted or hasn't synced yet.
        </EmptyState>
      </Page>
    )
  }
  return <ProgramView program={program} />
}

type SheetState = { type: 'add'; day: number } | { type: 'week' } | { type: 'program' } | { type: 'start'; n: number } | { type: null }

const isBlank = (p: ProgramDoc) => !p.title.trim() && !p.description.trim() && p.week_count === 1

/** A program: weeks of days, each holding workouts. Start it to put it on a calendar. */
function ProgramView({ program }: { program: ProgramDoc }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fresh = !!(location.state as { fresh?: boolean } | null)?.fresh
  const uid = useUserId()
  const qc = useQueryClient()
  const actions = useProgramActions(program.id)
  const isCoach = useProfile().data?.is_coach ?? false
  const openBlank = useOpenBlank('template')
  const saved = useTemplates()
  const [params, setParams] = useSearchParams()
  const week = Math.min(Math.max(Number(params.get('week') ?? 1) - 1 || 0, 0), program.week_count - 1)
  const setWeek = (w: number) => setParams(w === 0 ? {} : { week: String(w + 1) }, { replace: true })

  const [sheet, setSheet] = useState<SheetState>({ type: null })
  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = (s: SheetState) => {
    setSheet(s)
    setSheetOpen(true)
  }
  const sheetProps = { open: sheetOpen, onOpenChange: setSheetOpen }

  // A program made here and left with nothing in it is discarded. Its days are checked on the server:
  // a day just added may not be in the cache yet.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const id = program.id
    if (!fresh) return
    return () => {
      alive.current = false
      window.setTimeout(async () => {
        if (alive.current) return // StrictMode remount
        const busy = () =>
          qc.isMutating({ mutationKey: ['createProgram'] }) || qc.isMutating({ mutationKey: ['createWorkout'] }) || qc.isMutating({ mutationKey: ['program', id] })
        while (busy()) await new Promise((r) => window.setTimeout(r, 100))
        const latest = qc.getQueryData<ProgramDoc | null>(keys.program(uid, id))
        if (!latest || !isBlank(latest)) return
        const { count } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('program_id', id)
        if (count !== 0) return
        await supabase.from('programs').delete().eq('id', id)
        qc.removeQueries({ queryKey: keys.program(uid, id) })
        qc.invalidateQueries({ queryKey: keys.programs(uid) })
      }, 0)
    }
  }, [program.id, fresh, qc, uid])

  const days = program.workouts.filter((w) => Math.floor(w.program_day / 7) === week)
  const byWeekday = (d: number) => days.filter((w) => w.program_day % 7 === d)

  const addWeek = () => {
    // A new week starts as a copy of the last one, so a block is built by repeating a week.
    const last = program.week_count - 1
    const copyFrom = program.workouts.some((w) => Math.floor(w.program_day / 7) === last) ? last : undefined
    actions.insertWeek.mutate(
      { at: program.week_count, copyFrom },
      {
        onSuccess: () => {
          setWeek(program.week_count)
          toast(copyFrom == null ? `Week ${program.week_count + 1} added` : `Week ${program.week_count + 1} added as a copy of week ${last + 1}`)
        },
      },
    )
  }

  const addTo = (day: number) => {
    if (saved.data?.length) openSheet({ type: 'add', day })
    else openBlank({ program: { id: program.id, day } })
  }

  const deleteProgram = () => {
    setSheetOpen(false)
    actions.remove.mutate(undefined, {
      onSuccess: () => {
        navigate('/workouts/saved', { replace: true, viewTransition: true })
        toast('Program deleted')
      },
    })
  }

  const addDay = sheet.type === 'add' ? sheet.day : 0
  const weekHasWorkouts = days.length > 0

  return (
    <>
      <Page className="pb-40">
        <PageHeader
          back
          eyebrow={`Program · ${plural(program.week_count, 'week')}`}
          title={<TitleField program={program} autoFocus={fresh && !program.title} onSave={(title) => actions.update.mutate({ title })} />}
          subtitle={<DescriptionField program={program} onSave={(description) => actions.update.mutate({ description })} />}
          actions={
            <IconButton aria-label="More actions" onClick={() => openSheet({ type: 'program' })}>
              <Ellipsis className="size-[22px]" />
            </IconButton>
          }
        />

        <div role="tablist" aria-label="Weeks" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {Array.from({ length: program.week_count }, (_, w) => (
            <WeekChip key={w} selected={w === week} onClick={() => setWeek(w)}>
              Week {w + 1}
            </WeekChip>
          ))}
          {program.week_count < 52 && (
            <Chip selected={false} onClick={addWeek} icon={<Plus className="size-4" strokeWidth={2.4} />}>
              Week
            </Chip>
          )}
        </div>

        <div className="mb-1 flex min-h-9 items-center justify-between px-1">
          <SectionLabel>Week {week + 1}</SectionLabel>
          <IconButton size="sm" aria-label={`Week ${week + 1} actions`} onClick={() => openSheet({ type: 'week' })} className="-mr-1.5">
            <Ellipsis className="size-5" />
          </IconButton>
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, d) => {
            const items = byWeekday(d)
            const day = week * 7 + d
            return (
              <section key={d} aria-label={programDayLabel(day)}>
                <div className="flex min-h-9 items-center gap-2 px-1">
                  <SectionLabel className="flex-1">{weekdayName(d)}</SectionLabel>
                  {items.length === 0 && <span className="text-footnote text-faint">Rest</span>}
                  <IconButton size="sm" aria-label={`Add a workout on ${programDayLabel(day)}`} onClick={() => addTo(day)} className="-mr-1.5">
                    <Plus className="size-[18px]" strokeWidth={2.2} />
                  </IconButton>
                </div>
                {items.length > 0 && (
                  <ListGroup className="mt-1">
                    {items.map((w) => (
                      <DayRow key={w.id} w={w} />
                    ))}
                  </ListGroup>
                )}
              </section>
            )
          })}
        </div>
      </Page>

      <BottomBar>
        <Button size="lg" block disabled={program.workouts.length === 0} onClick={() => openSheet({ type: 'start', n: Date.now() })}>
          <Play className="size-[18px] fill-current" /> Start program
        </Button>
      </BottomBar>

      <AddWorkoutSheet
        open={sheetOpen && sheet.type === 'add'}
        onOpenChange={setSheetOpen}
        date=""
        target={{
          title: `Add to ${programDayLabel(addDay)}`,
          onBlank: () => openBlank({ program: { id: program.id, day: addDay } }),
          onSaved: (w) =>
            actions.addSaved.mutate({ day: addDay, source: w.id }, { onSuccess: () => toast(`Added ${w.title || 'workout'} to ${programDayLabel(addDay)}`) }),
        }}
      />
      <WorkoutActionsSheet
        {...sheetProps}
        open={sheetOpen && sheet.type === 'week'}
        title={`Week ${week + 1}`}
        items={[
          ...(program.week_count < 52
            ? [
                {
                  icon: <Copy />,
                  label: 'Duplicate week',
                  onClick: () =>
                    actions.insertWeek.mutate(
                      { at: week + 1, copyFrom: week },
                      {
                        onSuccess: () => {
                          setWeek(week + 1)
                          toast(`Week ${week + 2} is a copy of week ${week + 1}`)
                        },
                      },
                    ),
                },
              ]
            : []),
          ...(weekHasWorkouts ? [{ icon: <Eraser />, label: 'Clear week', onClick: () => actions.clearWeek.mutate(week) }] : []),
        ]}
        destructive={
          program.week_count > 1
            ? {
                label: 'Delete week…',
                warning: `Removes week ${week + 1} and its workouts. Later weeks move up.`,
                confirm: 'Delete week',
                onConfirm: () => {
                  setSheetOpen(false)
                  actions.deleteWeek.mutate(week, { onSuccess: () => setWeek(Math.max(0, week - 1)) })
                },
              }
            : undefined
        }
      />
      <WorkoutActionsSheet
        {...sheetProps}
        open={sheetOpen && sheet.type === 'program'}
        title={program.title || 'Untitled program'}
        items={
          program.workouts.length
            ? [
                ...(isCoach
                  ? [{ icon: <Send />, label: 'Assign to clients…', onClick: () => navigate(`/coach/assign?program=${program.id}`, { viewTransition: true }) }]
                  : []),
                { icon: <Play />, label: 'Start program…', onClick: () => window.setTimeout(() => openSheet({ type: 'start', n: Date.now() }), 250) },
              ]
            : []
        }
        destructive={{
          label: 'Delete program…',
          warning: 'Workouts it already put on a plan stay there.',
          confirm: 'Delete program',
          onConfirm: deleteProgram,
        }}
      />
      <StartProgramSheet key={sheet.type === 'start' ? sheet.n : 'start'} open={sheetOpen && sheet.type === 'start'} onOpenChange={setSheetOpen} program={program} />
    </>
  )
}

function WeekChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [selected])
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 select-none items-center rounded-full px-3.5 text-subhead font-semibold whitespace-nowrap active:scale-[0.96]',
        selected ? 'glass-tint' : 'glass-control text-muted',
      )}
    >
      {children}
    </button>
  )
}

function DayRow({ w }: { w: ProgramDay }) {
  return (
    <ListRow
      to={`/w/${w.id}`}
      title={w.title || 'Untitled workout'}
      subtitle={[w.subtitle, describeWorkout(w)].filter(Boolean).join(' · ')}
      trailing="chevron"
    />
  )
}

function TitleField({ program, autoFocus, onSave }: { program: ProgramDoc; autoFocus: boolean; onSave: (title: string) => void }) {
  const { draft, setDraft, setFocused } = useDraft(program.title)
  const { schedule, flush } = useAutosave(onSave)
  return (
    <input
      aria-label="Program title"
      autoFocus={autoFocus}
      placeholder="Untitled program"
      value={draft}
      enterKeyHint="done"
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        flush()
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => {
        setDraft(e.target.value)
        schedule(e.target.value)
      }}
      className="w-full bg-transparent outline-none placeholder:text-faint"
    />
  )
}

function DescriptionField({ program, onSave }: { program: ProgramDoc; onSave: (description: string) => void }) {
  const { draft, setDraft, setFocused } = useDraft(program.description)
  const { schedule, flush } = useAutosave(onSave)
  return (
    <input
      aria-label="Program description"
      placeholder="Add a description"
      value={draft}
      enterKeyHint="done"
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        flush()
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => {
        setDraft(e.target.value)
        schedule(e.target.value)
      }}
      className="mt-1 w-full bg-transparent text-body text-muted outline-none placeholder:text-faint"
    />
  )
}
