import { useRef, useState } from 'react'
import { Dumbbell, GripVertical, Link2, Type } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import type { BlockWithSets } from '@/data/types'
import { groupBlocks, type BlockUnit } from '@/lib/blocks'
import { useWorkoutPage } from './context'

export const blockLabel = (b: BlockWithSets) =>
  b.type === 'exercise' ? (b.exercise?.name ?? 'Exercise') : b.title || b.body.split('\n')[0] || 'Text'

const unitIds = (unit: BlockUnit<BlockWithSets>) => (unit.kind === 'group' ? unit.blocks.map((b) => b.id) : [unit.block.id])

/**
 * Compact one-line rows with drag handles, so dragging never fights with scrolling or inputs. A superset
 * moves as one row, so its exercises stay together.
 */
export function ReorderList() {
  const { doc, actions } = useWorkoutPage()
  const units = groupBlocks(doc.workout_blocks)
  const byKey = new Map(units.map((u) => [u.key, u]))
  const [order, setOrder] = useState(() => units.map((u) => u.key))
  const latest = useRef(order)

  const commit = () => {
    const saved = doc.workout_blocks.map((b) => b.id)
    const next = latest.current.flatMap((key) => {
      const unit = byKey.get(key)
      return unit ? unitIds(unit) : []
    })
    // Anything not shown as a row (it changed meanwhile) keeps its place at the end.
    const ids = [...next, ...saved.filter((id) => !next.includes(id))]
    if (ids.join() !== saved.join()) actions.reorderBlocks.mutate(ids)
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
      {order.map((key) => {
        const unit = byKey.get(key)
        return unit ? <ReorderRow key={key} value={key} unit={unit} onDragEnd={commit} /> : null
      })}
    </Reorder.Group>
  )
}

function ReorderRow({ value, unit, onDragEnd }: { value: string; unit: BlockUnit<BlockWithSets>; onDragEnd: () => void }) {
  const controls = useDragControls()
  const group = unit.kind === 'group'
  const Icon = group ? Link2 : unit.block.type === 'exercise' ? Dumbbell : Type
  const label = group ? unit.blocks.map(blockLabel).join(' + ') : blockLabel(unit.block)
  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--elev-float)' }}
      className="glass-card relative flex items-center gap-3 rounded-card pl-4 select-none"
    >
      <Icon className={group ? 'size-4 shrink-0 text-accent-text' : 'size-4 shrink-0 text-faint'} />
      <span className="min-w-0 flex-1 py-4">
        {group && <span className="block text-micro font-semibold uppercase text-accent-text">Superset</span>}
        <span className="block truncate text-body font-semibold">{label}</span>
      </span>
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
