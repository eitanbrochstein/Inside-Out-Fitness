import { useState } from 'react'
import { ArrowUp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useUserId } from '@/features/auth/AuthProvider'
import { useAddComment, useComments, useDeleteComment } from '@/data/useCoaching'
import { useProfile } from '@/data/useProfile'
import { formatTimestamp } from '@/lib/dates'
import { AutoTextarea } from '@/ui/AutoTextarea'
import { Avatar } from '@/ui/Avatar'
import { cn } from '@/ui/cn'
import { SectionLabel } from '@/ui/SectionLabel'

/** A short thread between a client and their coach on one workout. */
export function Comments({ workoutId, ownerId }: { workoutId: string; ownerId: string }) {
  const uid = useUserId()
  const me = useProfile().data?.display_name ?? 'You'
  const { data: comments } = useComments(workoutId)
  const add = useAddComment(workoutId)
  const remove = useDeleteComment(workoutId)
  const [draft, setDraft] = useState('')

  const send = () => {
    const body = draft.trim()
    if (!body) return
    add.mutate({
      id: crypto.randomUUID(),
      workout_id: workoutId,
      owner_id: ownerId,
      author_id: uid,
      body,
      created_at: new Date().toISOString(),
      author: { display_name: me },
    })
    setDraft('')
  }

  return (
    <section className="mt-8">
      <SectionLabel className="mb-2 px-1">Comments</SectionLabel>
      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {(comments ?? []).map((c) => {
            const mine = c.author_id === uid
            const name = mine ? 'You' : c.author?.display_name || 'Coach'
            return (
              <motion.div
                key={c.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3"
              >
                <Avatar name={mine ? me : name} className="size-8 text-caption" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-footnote">
                    <span className="font-semibold">{name}</span>
                    <span className="text-faint">{formatTimestamp(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-callout leading-snug whitespace-pre-wrap">{c.body}</p>
                </div>
                {mine && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => remove.mutate(c.id)}
                    className="-mt-1 flex size-8 items-center justify-center rounded-full text-faint active:bg-(--glass-press)"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
        {comments?.length === 0 && <p className="px-1 text-subhead text-faint">No comments yet.</p>}
      </div>

      <div className="glass-field mt-4 flex items-end gap-2 rounded-[24px] py-1.5 pr-1.5 pl-4">
        <AutoTextarea
          aria-label="Write a comment"
          placeholder="Write a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          }}
          className="max-h-40 py-2 text-body leading-snug"
        />
        <button
          type="button"
          aria-label="Send comment"
          onClick={send}
          disabled={!draft.trim()}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full active:scale-95',
            draft.trim() ? 'glass-tint' : 'bg-surface-3 text-faint',
          )}
        >
          <ArrowUp className="size-5" strokeWidth={2.4} />
        </button>
      </div>
    </section>
  )
}
