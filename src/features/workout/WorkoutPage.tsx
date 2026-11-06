import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown, Bookmark, CalendarPlus, ClipboardList, Copy, Ellipsis, LayoutList, Play, Plus, Repeat, Send } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useUserId } from '@/features/auth/AuthProvider'
import { ExercisePickerSheet } from '@/features/exercises/ExercisePickerSheet'
import { MaxSheet } from '@/features/exercises/MaxSheet'
import { keys } from '@/data/keys'
import type { BlockWithSets, Exercise, MaxKind, WorkoutDoc } from '@/data/types'
import { useCurrentMaxes } from '@/data/useMaxes'
import { useClients } from '@/data/useCoaching'
import { useProfile, useUnits } from '@/data/useProfile'
import { useProgram } from '@/data/usePrograms'
import { useWorkoutStats } from '@/data/useStats'
import { newBlockRow, newSetRow, useWorkout, useWorkoutActions } from '@/data/useWorkout'
import { useCopyWorkout } from '@/data/useWorkouts'
import { programDayLabel } from '@/lib/calendar'
import { formatScheduled, formatTimestamp, lowerRelative } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import { useAutosave, useDraft } from '@/lib/useAutosave'
import { useWakeLock } from '@/lib/useWakeLock'
import { BottomBar } from '@/ui/BottomBar'
import { Button } from '@/ui/Button'
import { DatePill } from '@/ui/DatePill'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { SegmentedControl } from '@/ui/SegmentedControl'
import { Skeleton } from '@/ui/Skeleton'
import { ease } from '@/ui/motion'
import { useWorkoutPage, WorkoutPageContext, type Mode, type WorkoutPageState } from './context'
import { Comments } from './Comments'
import { ExerciseBlock } from './ExerciseBlock'
import { ReorderList } from './ReorderList'
import { CompletedSummary } from './SessionSummary'
import { BlockActionsSheet, FinishSheet, ScheduleSheet, WorkoutActionsSheet } from './Sheets'
import { TextBlock } from './TextBlock'
import { TrainStrip } from './TrainStrip'

export function WorkoutPage() {
  const { id } = useParams()
  return <WorkoutLoader key={id} id={id!} />
}

function WorkoutLoader({ id }: { id: string }) {
  const { data: doc, isPending } = useWorkout(id)
  if (isPending) {
    return (
      <Page>
        <PageHeader back title={<Skeleton className="h-8 w-56 rounded-lg" />} />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[84px]" />
          ))}
        </div>
      </Page>
    )
  }
  if (!doc) {
    return (
      <Page>
        <PageHeader back title="Workout not found" />
        <EmptyState icon={<LayoutList />} title="Not found">
          This workout was deleted or hasn't synced yet.
        </EmptyState>
      </Page>
    )
  }
  return <WorkoutView doc={doc} />
}

type SheetState =
  | { type: 'block'; block: BlockWithSets }
  | { type: 'max'; exerciseId: string; kind: MaxKind; n: number }
  | { type: 'picker'; replace: BlockWithSets | null }
  | { type: 'finish' }
  | { type: 'workout' }
  | { type: 'schedule' }
  | { type: null }

const isEmptyDoc = (d: WorkoutDoc) => d.status === 'planned' && !d.title.trim() && !d.subtitle.trim() && d.workout_blocks.length === 0

function WorkoutView({ doc }: { doc: WorkoutDoc }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fresh = !!(location.state as { fresh?: boolean } | null)?.fresh
  const qc = useQueryClient()
  const uid = useUserId()
  const isCoach = useProfile().data?.is_coach ?? false
  const isOwner = doc.owner_id === uid
  const isTemplate = doc.kind === 'template'
  // A coach changes a workout they assigned until the client starts it. Anything else of a client's is read-only.
  const coachEdit = !isOwner && !isTemplate && doc.assigned_by === uid && doc.status === 'planned'
  const readOnly = !isOwner && !coachEdit
  // A day of a program: a template that lives in the program rather than the library.
  const programDay = doc.program_id && doc.program_day != null ? { id: doc.program_id, day: doc.program_day } : null
  const program = useProgram(programDay?.id)
  const untitled = isTemplate && isCoach && !programDay ? 'Untitled template' : 'Untitled workout'
  const clients = useClients({ enabled: !isOwner })
  const client = clients.byId.get(doc.owner_id)
  const ownerName = client?.name ?? 'Client'
  const firstName = ownerName.split(/\s+/)[0]
  const actions = useWorkoutActions(doc.id, {
    ownerId: doc.owner_id,
    guarded: !isOwner,
    onLocked: () => toast.error(`${firstName} started this workout, so it's read-only now.`, { id: `locked-${doc.id}` }),
  })
  const copy = useCopyWorkout()
  const myUnits = useUnits()
  // Loads read the way the client sees them: their unit and their plate rounding.
  const units = useMemo(() => (client ? { unit: client.unit, rounding: client.rounding } : myUnits), [client, myUnits])
  const maxes = useCurrentMaxes(doc.owner_id)
  const exerciseIds = useMemo(() => doc.workout_blocks.flatMap((b) => (b.exercise_id ? [b.exercise_id] : [])), [doc.workout_blocks])
  const stats = useWorkoutStats(doc.id, isTemplate ? [] : exerciseIds, doc.owner_id)

  const [ownMode, setMode] = useState<Mode>(isTemplate || doc.status === 'planned' ? 'edit' : 'train')
  // A coach plans until the client starts, then reads what was logged.
  const mode: Mode = isOwner ? ownMode : coachEdit ? 'edit' : 'train'
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [reordering, setReordering] = useState(false)
  const [focusBlock, setFocusBlock] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>({ type: null })
  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = (s: SheetState) => {
    setSheet(s)
    setSheetOpen(true)
  }
  const sheetProps = (type: SheetState['type']) => ({ open: sheetOpen && sheet.type === type, onOpenChange: setSheetOpen })

  const completed = doc.status === 'completed'
  useWakeLock(mode === 'train' && !completed && isOwner && !isTemplate)

  // Leaving an empty page discards it: one of your own, or one you just put on a client's calendar.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const id = doc.id
    return () => {
      alive.current = false
      window.setTimeout(async () => {
        if (alive.current) return // StrictMode remount
        const latest = qc.getQueryData<WorkoutDoc | null>(keys.workout(id))
        if (!latest || !isEmptyDoc(latest)) return
        if (latest.owner_id === uid ? latest.assigned_by : !(fresh && latest.assigned_by === uid)) return
        while (qc.isMutating({ mutationKey: ['createWorkout'] }) || qc.isMutating({ mutationKey: ['workout', id] })) {
          await new Promise((r) => window.setTimeout(r, 100))
        }
        await supabase.from('workouts').delete().eq('id', id)
        qc.removeQueries({ queryKey: keys.workout(id) })
        qc.invalidateQueries({ queryKey: keys.workouts(latest.owner_id) })
      }, 0)
    }
  }, [doc.id, qc, uid, fresh])

  const toggle = (blockId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })

  const switchMode = (next: Mode) => {
    setReordering(false)
    setMode(next)
    if (next === 'train' && expanded.size === 0) {
      const first = doc.workout_blocks.find((b) => b.type === 'exercise' && b.workout_sets.some((s) => !s.completed_at))
      if (first) setExpanded(new Set([first.id]))
    }
  }

  const deleteBlockWithUndo = (block: BlockWithSets) => {
    actions.deleteBlock.mutate(block)
    toast('Block deleted', { action: { label: 'Undo', onClick: () => actions.restoreBlock.mutate(block) }, duration: 6000 })
  }

  const nextPosition = (doc.workout_blocks.at(-1)?.position ?? -1) + 1
  const scrollTo = (id: string) =>
    window.setTimeout(() => document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)

  const addText = () => {
    const block = newBlockRow({ workout_id: doc.id, owner_id: doc.owner_id, position: nextPosition, type: 'text' })
    actions.addBlock.mutate({ ...block, exercise: null, workout_sets: [] })
    setFocusBlock(block.id)
    scrollTo(block.id)
  }

  const pickExercise = (exercise: Exercise) => {
    if (sheet.type === 'picker' && sheet.replace) {
      actions.changeExercise.mutate({ id: sheet.replace.id, exercise })
      return
    }
    const block = newBlockRow({ workout_id: doc.id, owner_id: doc.owner_id, position: nextPosition, type: 'exercise', exercise_id: exercise.id })
    actions.addBlock.mutate({
      ...block,
      exercise,
      workout_sets: [newSetRow({ block_id: block.id, owner_id: doc.owner_id, position: 0 })],
    })
    setExpanded((prev) => new Set(prev).add(block.id))
    scrollTo(block.id)
  }

  const copyAs = (kind: 'workout' | 'template', message: string) => {
    const id = crypto.randomUUID()
    copy.mutate(
      { source: doc.id, id, kind },
      {
        onSuccess: () => {
          toast(message)
          navigate(`/w/${id}`, { viewTransition: true })
        },
      },
    )
  }

  // Saving and scheduling keep you on this page; the toast leads to the copy.
  const copyAndStay = (kind: 'workout' | 'template', message: string, scheduledFor?: string) => {
    const id = crypto.randomUUID()
    copy.mutate(
      { source: doc.id, id, kind, scheduledFor },
      { onSuccess: () => toast(message, { action: { label: 'Open', onClick: () => navigate(`/w/${id}`, { viewTransition: true }) } }) },
    )
  }

  const deleteWorkout = async () => {
    setSheetOpen(false)
    // A coach's delete matches nothing once the client has started, so count what went.
    const { data, error } = await supabase.from('workouts').delete().eq('id', doc.id).select('id')
    if (error || !data?.length) {
      toast.error(isOwner ? "Couldn't delete that" : `${firstName} started this workout, so it stays.`)
      qc.invalidateQueries({ queryKey: keys.workout(doc.id) })
      return
    }
    qc.invalidateQueries({ queryKey: keys.workouts(doc.owner_id) })
    qc.invalidateQueries({ queryKey: keys.stats(doc.owner_id) })
    qc.invalidateQueries({ queryKey: ['coaching'] })
    const [to, message] = programDay
      ? [`/programs/${programDay.id}${programDay.day >= 7 ? `?week=${Math.floor(programDay.day / 7) + 1}` : ''}`, 'Removed from the program']
      : isTemplate
        ? isCoach
          ? ['/coach/templates', 'Template deleted']
          : ['/workouts/saved', 'Saved workout deleted']
        : !isOwner
          ? [`/coach/clients/${doc.owner_id}`, 'Assignment removed']
          : [completed ? '/workouts/history' : '/workouts', 'Workout deleted']
    navigate(to, { replace: true, viewTransition: true })
    qc.removeQueries({ queryKey: keys.workout(doc.id) })
    toast(message)
  }

  const reorder = () => {
    setMode('edit')
    setReordering(true)
  }
  const canReorder = doc.workout_blocks.length > 1

  const saveItem = isCoach
    ? { icon: <ClipboardList />, label: 'Save as template', onClick: () => copyAndStay('template', 'Saved as a template') }
    : { icon: <Bookmark />, label: 'Save workout', onClick: () => copyAndStay('template', 'Saved to your library') }
  const reorderItems = canReorder ? [{ icon: <ArrowUpDown />, label: 'Reorder blocks', onClick: reorder }] : []

  // The page's ⋯ menu, by what this workout is to you.
  const menuFor = (): Omit<Parameters<typeof WorkoutActionsSheet>[0], 'open' | 'onOpenChange'> | null => {
    if (programDay) {
      return {
        title: doc.title || untitled,
        items: [saveItem, ...reorderItems],
        destructive: {
          label: 'Remove from program…',
          warning: `Takes it off ${programDayLabel(programDay.day)}. Workouts the program already put on a plan stay.`,
          confirm: 'Remove from program',
          onConfirm: deleteWorkout,
        },
      }
    }
    if (isTemplate) {
      return {
        title: doc.title || untitled,
        items: [
          ...(isCoach
            ? [{ icon: <Send />, label: 'Assign to clients', onClick: () => navigate(`/coach/assign?template=${doc.id}`, { viewTransition: true }) }]
            : []),
          { icon: <Play />, label: 'Start now', onClick: () => copyAs('workout', 'New workout created') },
          { icon: <CalendarPlus />, label: 'Schedule…', onClick: () => window.setTimeout(() => openSheet({ type: 'schedule' }), 250) },
          { icon: <Copy />, label: 'Duplicate', onClick: () => copyAs('template', isCoach ? 'Template duplicated' : 'Saved workout duplicated') },
          ...reorderItems,
        ],
        destructive: isCoach
          ? { label: 'Delete template…', warning: 'Workouts already assigned from it stay with your clients.', confirm: 'Delete template', onConfirm: deleteWorkout }
          : {
              label: 'Delete saved workout…',
              warning: "Workouts you've already started from it stay in your journal.",
              confirm: 'Delete saved workout',
              onConfirm: deleteWorkout,
            },
      }
    }
    if (coachEdit) {
      return {
        title: doc.title || 'Untitled workout',
        items: [saveItem, ...reorderItems],
        destructive: {
          label: 'Remove assignment…',
          warning: `This removes the workout from ${ownerName}'s journal. They haven't started it yet.`,
          confirm: 'Remove assignment',
          onConfirm: deleteWorkout,
        },
      }
    }
    if (readOnly) return null
    return {
      title: doc.title || 'Untitled workout',
      items: [{ icon: <Repeat />, label: 'Repeat as new workout', onClick: () => copyAs('workout', 'New workout created') }, saveItem, ...reorderItems],
      destructive: {
        label: 'Delete workout…',
        warning: "This removes the workout and every set logged in it. This can't be undone.",
        confirm: 'Delete workout',
        onConfirm: deleteWorkout,
      },
    }
  }
  const menuItems = menuFor()
  const menu = menuItems && { ...sheetProps('workout'), ...menuItems }

  const state: WorkoutPageState = {
    doc,
    actions,
    mode,
    readOnly,
    isTemplate,
    isCoach,
    statsHref: (exerciseId) => (!isOwner ? `/coach/clients/${doc.owner_id}/progress/${exerciseId}` : `/exercises/${exerciseId}`),
    // A coach looking at an unstarted assignment wants the plan, not "0 of 3 sets".
    summaryMode: mode === 'edit' || (readOnly && doc.status === 'planned') ? 'edit' : completed ? 'done' : 'train',
    units,
    maxes,
    stats,
    expanded,
    toggle,
    openBlockActions: (block) => openSheet({ type: 'block', block }),
    openMaxSheet: (exerciseId, kind) => openSheet({ type: 'max', exerciseId, kind, n: Date.now() }),
    deleteBlockWithUndo,
  }

  const status = completed
    ? `Completed · ${formatTimestamp(doc.completed_at!)}`
    : doc.status === 'in_progress'
      ? 'In progress'
      : 'Planned'
  const eyebrow = programDay
    ? `${program.data?.title || 'Program'} · ${programDayLabel(programDay.day)}`
    : isTemplate
      ? isCoach
        ? 'Template'
        : 'Saved workout'
      : !isOwner
        ? `${ownerName} · ${status}`
        : doc.assigned_by
          ? `From ${doc.coach?.display_name || 'your coach'} · ${status}`
          : status
  const editable = mode === 'edit' && !readOnly

  return (
    <WorkoutPageContext value={state}>
      <Page className={readOnly ? 'pb-16' : 'pb-40'}>
        <PageHeader
          back
          eyebrow={eyebrow}
          title={<TitleField doc={doc} editable={editable} autoFocus={fresh} placeholder={untitled} />}
          subtitle={<SubtitleField doc={doc} editable={editable} showDate={!isTemplate} />}
          actions={
            menu && (
              <IconButton aria-label="More actions" onClick={() => openSheet({ type: 'workout' })}>
                <Ellipsis className="size-[22px]" />
              </IconButton>
            )
          }
        />

        {coachEdit && <p className="-mt-2 mb-4 px-0.5 text-footnote text-muted">You can change this until {firstName} starts it.</p>}

        {isOwner && !isTemplate && (
          <SegmentedControl<Mode>
            aria-label="Mode"
            className="-mt-1 mb-5"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'edit', label: 'Edit' },
              { value: 'train', label: completed ? 'Logged' : 'Train' },
            ]}
          />
        )}

        {completed && !isTemplate && !reordering && mode === 'train' && <CompletedSummary doc={doc} />}

        {reordering ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-callout text-muted">Drag the handles to reorder.</p>
              <Button size="sm" variant="secondary" onClick={() => setReordering(false)}>
                Done
              </Button>
            </div>
            <ReorderList />
          </>
        ) : doc.workout_blocks.length === 0 ? (
          <EmptyState icon={<LayoutList />} title={isTemplate && isCoach && !programDay ? 'An empty template' : 'An empty page'}>
            {programDay
              ? `What's on ${programDayLabel(programDay.day)}. Percentages use the maxes of whoever's plan it lands on.`
              : isTemplate
                ? isCoach
                  ? "A template is a page of blocks. Use percentages, and each client's loads come from their own 1RM."
                  : 'Plan it once, start it any day. Percentages use your maxes on the day you start it.'
                : readOnly
                  ? 'Nothing planned in this workout yet.'
                  : mode === 'edit'
                    ? 'A workout is a page of blocks. Add text for warm-ups and notes, or an exercise to plan sets.'
                    : 'Nothing planned yet. Switch to Edit to add blocks.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {doc.workout_blocks.map((block) => (
                <motion.div
                  key={block.id}
                  id={`block-${block.id}`}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.25, ease }}
                  className="scroll-mt-24 scroll-mb-32"
                >
                  {block.type === 'exercise' ? (
                    <ExerciseBlock block={block} />
                  ) : (
                    <TextBlock block={block} autoFocus={focusBlock === block.id} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isTemplate && (!isOwner || doc.assigned_by) && <Comments workoutId={doc.id} ownerId={doc.owner_id} />}
      </Page>

      {!readOnly && (
        <BottomBar top={mode === 'train' && !completed && !isTemplate ? <TrainStrip doc={doc} /> : undefined}>
          {mode === 'edit' ? (
            <>
              <Button variant="secondary" size="lg" className="flex-1 px-2 text-callout whitespace-nowrap" onClick={addText}>
                <Plus className="size-[18px]" strokeWidth={2.4} />
                Text Block
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 px-2 text-callout whitespace-nowrap"
                onClick={() => openSheet({ type: 'picker', replace: null })}
              >
                <Plus className="size-[18px]" strokeWidth={2.4} />
                Exercise Block
              </Button>
            </>
          ) : completed ? (
            <Button variant="secondary" size="lg" block onClick={() => copyAs('workout', 'New workout created')} loading={copy.isPending}>
              <Repeat className="size-[18px]" />
              Repeat workout
            </Button>
          ) : (
            <Button size="lg" block onClick={() => openSheet({ type: 'finish' })}>
              Finish workout
            </Button>
          )}
        </BottomBar>
      )}

      {!readOnly && (
        <>
          <ExercisePickerSheet
            {...sheetProps('picker')}
            title={sheet.type === 'picker' && sheet.replace ? 'Change exercise' : 'Add exercise'}
            onPick={pickExercise}
          />
          <MaxSheet
            key={sheet.type === 'max' ? sheet.n : 'max'}
            {...sheetProps('max')}
            exerciseId={sheet.type === 'max' ? sheet.exerciseId : null}
            kind={sheet.type === 'max' ? sheet.kind : 'one_rm'}
            ownerId={doc.owner_id}
            ownerName={isOwner ? undefined : ownerName}
          />
          <BlockActionsSheet
            {...sheetProps('block')}
            block={sheet.type === 'block' ? (doc.workout_blocks.find((b) => b.id === sheet.block.id) ?? sheet.block) : null}
            onReorder={() => setReordering(true)}
            onChangeExercise={(block) => window.setTimeout(() => openSheet({ type: 'picker', replace: block }), 250)}
          />
          <FinishSheet {...sheetProps('finish')} />
          <ScheduleSheet
            {...sheetProps('schedule')}
            onSchedule={(date) => copyAndStay('workout', `Added to ${lowerRelative(formatScheduled(date))}`, date)}
          />
        </>
      )}
      {menu && <WorkoutActionsSheet {...menu} />}
    </WorkoutPageContext>
  )
}

function TitleField({
  doc,
  editable,
  autoFocus,
  placeholder,
}: {
  doc: WorkoutDoc
  editable: boolean
  autoFocus: boolean
  placeholder: string
}) {
  const { actions } = useWorkoutPage()
  const { draft, setDraft, setFocused } = useDraft(doc.title)
  const { schedule, flush } = useAutosave((title: string) => actions.updateWorkout.mutate({ title }))
  if (!editable) return <>{doc.title || placeholder}</>
  return (
    <input
      aria-label="Workout title"
      autoFocus={autoFocus}
      placeholder={placeholder}
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

function SubtitleField({ doc, editable, showDate }: { doc: WorkoutDoc; editable: boolean; showDate: boolean }) {
  const { actions } = useWorkoutPage()
  const { draft, setDraft, setFocused } = useDraft(doc.subtitle)
  const { schedule, flush } = useAutosave((subtitle: string) => actions.updateWorkout.mutate({ subtitle }))

  const date = (
    <DatePill
      label="Workout date"
      value={doc.scheduled_for}
      onChange={editable ? (scheduled_for) => actions.updateWorkout.mutate({ scheduled_for }) : undefined}
    />
  )

  return (
    <span className="mt-1 flex flex-col gap-2.5">
      {editable ? (
        <input
          aria-label="Workout subtitle"
          placeholder="Add a subtitle"
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
          className="w-full bg-transparent text-body text-muted outline-none placeholder:text-faint"
        />
      ) : (
        doc.subtitle && <span>{doc.subtitle}</span>
      )}
      {showDate && (editable || doc.scheduled_for) && !doc.completed_at && <span>{date}</span>}
    </span>
  )
}
