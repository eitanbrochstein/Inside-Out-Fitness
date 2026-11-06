import { describe, expect, it } from 'vitest'
import { sessionPoints, topSet } from './progress'

describe('topSet', () => {
  it('picks the heaviest set, breaking ties by reps', () => {
    expect(topSet([{ weightKg: 100, reps: 5 }, { weightKg: 110, reps: 2 }, { weightKg: 110, reps: 3 }])).toEqual({ weightKg: 110, reps: 3 })
  })

  it('treats bodyweight sets as lighter than loaded ones and compares reps', () => {
    expect(topSet([{ weightKg: null, reps: 12 }, { weightKg: null, reps: 15 }])).toEqual({ weightKg: null, reps: 15 })
    expect(topSet([{ weightKg: null, reps: 20 }, { weightKg: 10, reps: 5 }])).toEqual({ weightKg: 10, reps: 5 })
    expect(topSet([])).toBeNull()
  })
})

describe('sessionPoints', () => {
  it('groups sets by workout, sorted by date, with top set and best e1RM', () => {
    const points = sessionPoints([
      { workout_id: 'b', performed_at: '2026-10-08T10:00:00Z', weight_kg: 100, reps: 5 },
      { workout_id: 'a', performed_at: '2026-10-01T10:00:00Z', weight_kg: 95, reps: 5 },
      { workout_id: 'b', performed_at: '2026-10-08T10:00:00Z', weight_kg: 105, reps: 1 },
    ])
    expect(points.map((p) => p.workoutId)).toEqual(['a', 'b'])
    expect(points[1]).toMatchObject({ topWeightKg: 105, topReps: 1, setCount: 2 })
    expect(points[1].e1rmKg).toBeCloseTo(116.67, 2) // 100 × 5 beats 105 × 1
  })
})
