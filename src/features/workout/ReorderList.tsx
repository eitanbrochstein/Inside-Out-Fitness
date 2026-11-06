import { useRef, useState } from 'react'
import { Dumbbell, GripVertical, Type } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import type { BlockWithSets } from '@/data/types'
import { useWorkoutPage } from './context'

export const blockLabel = (b: BlockWithSets) =>
  b.type === 'exercise' ? (b.exercise?.name ?? 'Exercise') : b.title || b.body.split('\n')[0] || 'Text'

/** Compact one-line rows with drag handles, so dragging never fights with scrolling or inputs. */
export function ReorderList() {
  const { doc, actions } = useWorkoutPage()
  const [order, setOrder] = useState(() => doc.workout_blocks.map((b) => b.id))
  const latest = useRef(order)
  const byId = new Map(doc.workout_blocks.map((b) => [b.id, b]))

  const commit = () => {
    const saved = doc.workout_blocks.map((b) => b.id)
    if (latest.current.join() !== saved.join()) actions.reorderBlocks.mutate(latest.current)
  }

  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={(next) => {
        latest.current = next
        setOrder(next)
      }}
      className="flex flex-col gap-2"
    >
      {order.map((id) => {
        const block = byId.get(id)
        return block ? <ReorderRow key={id} block={block} onDragEnd={commit} /> : null
      })}
    </Reorder.Group>
  )
}

function ReorderRow({ block, onDragEnd }: { block: BlockWithSets; onDragEnd: () => void }) {
  const controls = useDragControls()
  const Icon = block.type === 'exercise' ? Dumbbell : Type
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--elev-float)' }}
      className="glass-card relative flex items-center gap-3 rounded-card pl-4 select-none"
    >
      <Icon className="size-4 shrink-0 text-faint" />
      <span className="min-w-0 flex-1 truncate py-4 text-body font-semibold">{blockLabel(block)}</span>
      <span
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="flex h-14 w-14 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
      >
        <GripVertical className="size-5" />
      </span>
    </Reorder.Item>
  )
}
