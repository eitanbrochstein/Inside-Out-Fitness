import { Link2, Plus } from 'lucide-react'
import type { BlockWithSets } from '@/data/types'
import { Card } from '@/ui/Card'
import { useWorkoutPage } from './context'
import { ExerciseBlock } from './ExerciseBlock'

/** Exercises paired into one block: done back to back, a set of each in turn. Tagged A1, A2, … */
export function SupersetCard({ blocks, letter }: { blocks: BlockWithSets[]; letter: string }) {
  const page = useWorkoutPage()
  const editable = page.mode === 'edit' && !page.readOnly
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[linear-gradient(180deg,var(--accent-2),var(--accent))]" />
      <div className="flex items-center gap-1.5 px-4 pt-3.5 text-micro font-semibold uppercase text-accent-text">
        <Link2 className="size-3.5" strokeWidth={2.6} />
        Superset
        <span className="font-medium normal-case text-faint">· a set of each, then repeat</span>
      </div>
      <div className="divide-y divide-border">
        {blocks.map((block, i) => (
          <div key={block.id} id={`block-${block.id}`} className="scroll-mt-24 scroll-mb-32">
            <ExerciseBlock block={block} embedded tag={`${letter}${i + 1}`} />
          </div>
        ))}
      </div>
      {editable && (
        <button
          type="button"
          onClick={() => page.addPaired(blocks.at(-1)!)}
          className="flex h-12 w-full select-none items-center justify-center gap-1.5 border-t border-border text-callout font-semibold text-accent-text transition-colors duration-150 active:bg-(--glass-press)"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          Add exercise to superset
        </button>
      )}
    </Card>
  )
}
