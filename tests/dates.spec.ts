import { describe, expect, it } from 'vitest'
import { nextRepeatDate, tasksForView, zonedDateTimeToEpoch } from '../src/core/dates.ts'
import type { Task } from '../src/core/types.ts'

function task(id: string, date?: string, time?: string, status: Task['status'] = 'open'): Task {
  return {
    id, title: id, note: '', checklist: [], priority: 'none', list: 'work', status,
    ...(date === undefined ? {} : { scheduledDate: date }),
    ...(time === undefined ? {} : { scheduledTime: time }),
    createdAt: Number(id.replace(/\D/g, '')) || 1,
    updatedAt: 1,
    ...(status === 'completed' ? { completedAt: 10 } : {}),
  }
}

describe('date and view logic', () => {
  it('clamps monthly repeats and advances daily and weekly dates', () => {
    expect(nextRepeatDate('2026-01-31', { frequency: 'monthly', interval: 1 })).toBe('2026-02-28')
    expect(nextRepeatDate('2026-08-25', { frequency: 'daily', interval: 2 })).toBe('2026-08-27')
    expect(nextRepeatDate('2026-08-25', { frequency: 'weekly', interval: 1 })).toBe('2026-09-01')
  })

  it('keeps overdue and today tasks in the today view and sorts by time', () => {
    const values = [task('3', '2026-08-25'), task('1', '2026-08-24', '18:00'), task('2', '2026-08-25', '09:00'), task('4')]
    expect(tasksForView(values, 'today', '2026-08-25').map(value => value.id)).toEqual(['1', '2', '3'])
    expect(tasksForView(values, 'inbox', '2026-08-25').map(value => value.id)).toEqual(['4'])
  })

  it('converts a named-zone wall time into the expected epoch', () => {
    expect(new Date(zonedDateTimeToEpoch('2026-08-25', '10:00', 'Asia/Shanghai')!).toISOString()).toBe('2026-08-25T02:00:00.000Z')
  })
})
