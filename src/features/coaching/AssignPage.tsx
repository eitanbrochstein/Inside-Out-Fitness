import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Check, ChevronRight, ClipboardList, Plus, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { MAX_LABEL, type MaxKind } from '@/data/types'
import { useAssignTemplate, useClientMaxes, useClients, type Client } from '@/data/useCoaching'
import { useProgram, usePrograms, useStartProgram } from '@/data/usePrograms'
import { useNewProgram } from '@/features/library/useNewProgram'
import { ProgramWindow, WeekStartPicker } from '@/features/plan/StartProgramSheet'
import { useNewWorkout } from '@/features/workouts/useNewWorkout'
import { workoutQuery } from '@/data/useWorkout'
import { useTemplates } from '@/data/useWorkouts'
import { firstMonday } from '@/lib/calendar'
import { formatScheduled, lowerRelative, todayISO } from '@/lib/dates'
import { plural } from '@/lib/format'
import { formatNumber, formatWeight, isPercentSet, percentLoad } from '@/lib/load'
import { BottomBar } from '@/ui/BottomBar'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { CheckIndicator } from '@/ui/Checkbox'
import { cn } from '@/ui/cn'
import { DatePill } from '@/ui/DatePill'
import { EmptyState } from '@/ui/EmptyState'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SectionLabel } from '@/ui/SectionLabel'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { Sheet, SheetAction } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'

const firstName = (c: Client) => c.name.split(/\s+/)[0]

type Mode = 'workout' | 'program'

/** Assign one workout on a date, or a whole program from a Monday, to any of your clients. */
export function AssignPage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('program') || params.get('mode') === 'program' ? 'program' : 'workout'
  const switcher = (
    <SegmentedControl<Mode>
      aria-label="What to assign"
      className="mb-5"
      value={mode}
      onChange={(m) =>
        setParams(
          (p) => {
            p.delete('template')
            p.delete('program')
            if (m === 'program') p.set('mode', 'program')
            else p.delete('mode')
            return p
          },
          { replace: true },
        )
      }
      options={[
        { value: 'workout', label: 'Workout' },
        { value: 'program', label: 'Program' },
      ]}
    />
  )
  return mode === 'program' ? <AssignProgram switcher={switcher} /> : <AssignWorkout switcher={switcher} />
}

function useChosenClients() {
  const [params] = useSearchParams()
  const fromClient = params.get('client')
  const clients = useClients()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(fromClient ? [fromClient] : []))
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const chosen = (clients.data ?? []).filter((c) => selected.has(c.id))
  return { clients, fromClient, selected, toggle, chosen }
}

function AssignWorkout({ switcher }: { switcher: ReactNode }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const templates = useTemplates()
  const { clients, fromClient, selected, toggle, chosen } = useChosenClients()
  const newTemplate = useNewWorkout('template')
  const assign = useAssignTemplate()
  const [date, setDate] = useState<string>(todayISO())
  const [picking, setPicking] = useState(false)

  const templateId = params.get('template') ?? templates.data?.[0]?.id ?? null
  const template = useQuery({ ...workoutQuery(templateId ?? ''), enabled: !!templateId }).data
  const clientIds = useMemo(() => (clients.data ?? []).map((c) => c.id), [clients.data])
  const maxOf = useClientMaxes(clientIds)

  // The heaviest percentage of the first percent-based exercise drives the preview, like "Bench · 80%".
  const key = useMemo(() => {
    for (const b of template?.workout_blocks ?? []) {
      const percents = b.workout_sets.filter(isPercentSet).map((s) => s.target_percent!)
      if (b.exercise && percents.length) return { exercise: b.exercise, kind: b.max_kind as MaxKind, percent: Math.max(...percents) }
    }
    return null
  }, [template])

  const submit = () => {
    if (!templateId || chosen.length === 0) return
    assign.mutate(
      { templateId, clientIds: chosen.map((c) => c.id), scheduledFor: date || null },
      {
        onSuccess: () => {
          toast.success(`Assigned to ${chosen.map(firstName).join(', ')}`, {
            description: "It's on their plan now.",
          })
          navigate(fromClient ? `/coach/clients/${fromClient}` : '/coach', { replace: true, viewTransition: true })
        },
      },
    )
  }

  if (templates.isPending || clients.isPending) {
    return (
      <Page>
        <PageHeader back eyebrow="Coaching" title="Assign Workout" />
        {switcher}
        <Skeleton className="h-80" />
      </Page>
    )
  }

  if (!templates.data?.length || !clients.data?.length) {
    return (
      <Page>
        <PageHeader back eyebrow="Coaching" title="Assign Workout" />
        {switcher}
        {!clients.data?.length ? (
          <NoClients />
        ) : (
          <EmptyState icon={<ClipboardList />} title="No templates yet" action={<Button onClick={newTemplate}>New Template</Button>}>
            Create a template to assign first.
          </EmptyState>
        )}
      </Page>
    )
  }

  return (
    <>
      <Page className="pb-36">
        <PageHeader back eyebrow="Coaching" title="Assign Workout" subtitle="Each client's loads come from their own maxes" />
        {switcher}

        <PickerButton label="Workout template" value={template?.title || 'Untitled template'} onClick={() => setPicking(true)} />

        <div className="mt-3">
          <DatePill size="md" label="Scheduled date" value={date || null} onChange={(d) => setDate(d ?? '')} />
        </div>

        <ClientChecklist
          clients={clients.data}
          selected={selected}
          toggle={toggle}
          detail={(c) => {
            if (!key) return null
            const max = maxOf(c.id, key.exercise.id, key.kind)
            return (
              <span className={cn('block text-subhead', max ? 'text-muted' : 'text-warn')}>
                {max
                  ? `${key.exercise.name} ${MAX_LABEL[key.kind]}: ${formatWeight(max.value_kg, c.unit)}`
                  : `No ${key.exercise.name} ${MAX_LABEL[key.kind]} yet`}
              </span>
            )
          }}
        />

        {key && chosen.length > 0 && (
          <Card className="mt-4 px-4 py-4">
            <SectionLabel>Automatic personalization</SectionLabel>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-body tabular-nums">
              {chosen.map((c) => {
                const max = maxOf(c.id, key.exercise.id, key.kind)
                const load = percentLoad({ maxKg: max?.value_kg ?? null, percent: key.percent, unit: c.unit, rounding: c.rounding })
                return (
                  <li key={c.id}>
                    {firstName(c)} <span className="text-faint">·</span> {formatNumber(key.percent)}% ={' '}
                    {load ? (
                      <span className="font-semibold">
                        {formatNumber(load.display)} {c.unit}
                      </span>
                    ) : (
                      <span className="text-warn">set a {MAX_LABEL[key.kind]} to calculate</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-footnote text-faint">{key.exercise.name}, heaviest set. Every percentage set is personalized the same way.</p>
          </Card>
        )}

        <Sheet open={picking} onOpenChange={setPicking} title="Choose a template">
          <div className="flex flex-col pb-2">
            {templates.data.map((t) => (
              <SheetAction
                key={t.id}
                icon={t.id === templateId ? <Check className="text-accent-text" strokeWidth={2.6} /> : <span />}
                onClick={() => {
                  setParams((p) => {
                    p.set('template', t.id)
                    return p
                  }, { replace: true })
                  setPicking(false)
                }}
              >
                {t.title || 'Untitled template'}
              </SheetAction>
            ))}
            <SheetAction icon={<Plus />} onClick={newTemplate}>
              New template
            </SheetAction>
          </div>
        </Sheet>
      </Page>
      <BottomBar>
        <Button size="lg" block disabled={!templateId || chosen.length === 0} loading={assign.isPending} onClick={submit}>
          {chosen.length > 1 ? `Assign to ${chosen.length} clients` : 'Assign Workout'}
        </Button>
      </BottomBar>
    </>
  )
}

function AssignProgram({ switcher }: { switcher: ReactNode }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const programs = usePrograms()
  const { clients, fromClient, selected, toggle, chosen } = useChosenClients()
  const newProgram = useNewProgram()
  const start = useStartProgram()
  const [monday, setMonday] = useState(() => firstMonday(todayISO()))
  const [picking, setPicking] = useState(false)

  const programId = params.get('program') ?? programs.data?.[0]?.id ?? null
  const program = useProgram(programId).data

  const submit = () => {
    if (!programId || chosen.length === 0) return
    start.mutate(
      { programId, start: monday, clientIds: chosen.map((c) => c.id), skipBefore: todayISO() },
      {
        onSuccess: () => {
          toast.success(`Started for ${chosen.map(firstName).join(', ')}`, {
            description: `It's on their plans from ${lowerRelative(formatScheduled(monday))}.`,
          })
          navigate(fromClient ? `/coach/clients/${fromClient}?week=${monday}` : '/coach', { replace: true, viewTransition: true })
        },
      },
    )
  }

  if (programs.isPending || clients.isPending) {
    return (
      <Page>
        <PageHeader back eyebrow="Coaching" title="Assign Program" />
        {switcher}
        <Skeleton className="h-80" />
      </Page>
    )
  }

  if (!programs.data?.length || !clients.data?.length) {
    return (
      <Page>
        <PageHeader back eyebrow="Coaching" title="Assign Program" />
        {switcher}
        {!clients.data?.length ? (
          <NoClients />
        ) : (
          <EmptyState icon={<CalendarRange />} title="No programs yet" action={<Button onClick={newProgram}>New Program</Button>}>
            A program strings workouts into weeks. Build one, then start it for several clients at once.
          </EmptyState>
        )}
      </Page>
    )
  }

  return (
    <>
      <Page className="pb-36">
        <PageHeader back eyebrow="Coaching" title="Assign Program" subtitle="Each client's loads come from their own maxes" />
        {switcher}

        <PickerButton
          label="Program"
          value={program?.title || 'Untitled program'}
          detail={program && `${plural(program.week_count, 'week')} · ${plural(program.workouts.length, 'workout')}`}
          onClick={() => setPicking(true)}
        />

        <SectionLabel className="mt-6 mb-2 px-1">First week</SectionLabel>
        <div className="flex flex-col gap-3 px-1">
          <WeekStartPicker value={monday} onChange={setMonday} />
          {program && <ProgramWindow program={program} monday={monday} />}
        </div>

        <ClientChecklist clients={clients.data} selected={selected} toggle={toggle} />

        <Sheet open={picking} onOpenChange={setPicking} title="Choose a program">
          <div className="flex flex-col pb-2">
            {programs.data.map((p) => (
              <SheetAction
                key={p.id}
                icon={p.id === programId ? <Check className="text-accent-text" strokeWidth={2.6} /> : <span />}
                onClick={() => {
                  setParams((q) => {
                    q.set('program', p.id)
                    return q
                  }, { replace: true })
                  setPicking(false)
                }}
              >
                {p.title || 'Untitled program'}
              </SheetAction>
            ))}
            <SheetAction icon={<Plus />} onClick={newProgram}>
              New program
            </SheetAction>
          </div>
        </Sheet>
      </Page>
      <BottomBar>
        <Button
          size="lg"
          block
          disabled={!programId || chosen.length === 0 || !program?.workouts.length}
          loading={start.isPending}
          onClick={submit}
        >
          {chosen.length > 1 ? `Assign to ${chosen.length} clients` : 'Assign Program'}
        </Button>
      </BottomBar>
    </>
  )
}

function PickerButton({ label, value, detail, onClick }: { label: string; value: string; detail?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      data-interactive
      onClick={onClick}
      className="glass-card flex w-full select-none items-center gap-3 rounded-card px-4 py-4 text-left active:scale-[0.98]"
    >
      <span className="min-w-0 flex-1">
        <SectionLabel>{label}</SectionLabel>
        <span className="mt-1.5 block truncate text-headline font-bold">{value}</span>
        {detail && <span className="mt-0.5 block truncate text-subhead text-muted">{detail}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-faint" />
    </button>
  )
}

function ClientChecklist({
  clients,
  selected,
  toggle,
  detail,
}: {
  clients: Client[]
  selected: Set<string>
  toggle: (id: string) => void
  detail?: (c: Client) => ReactNode
}) {
  return (
    <>
      <SectionLabel className="mt-6 mb-2 px-1">Select clients</SectionLabel>
      <div className="flex flex-col gap-3">
        {clients.map((c) => {
          const on = selected.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              data-interactive
              onClick={() => toggle(c.id)}
              className={cn(
                'glass-card flex select-none items-center gap-4 rounded-card px-4 py-3.5 text-left active:scale-[0.98]',
                on && 'border-accent-ring',
              )}
            >
              <CheckIndicator checked={on} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-headline font-semibold">{c.name}</span>
                {detail?.(c)}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function NoClients() {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={<Users />}
      title="No clients yet"
      action={<Button onClick={() => navigate('/coach/clients', { viewTransition: true })}>Invite a client</Button>}
    >
      Invite a client to assign workouts to.
    </EmptyState>
  )
}
