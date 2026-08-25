import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PlannerLedger } from '../src/host/ledger.ts'

const dirs: string[] = []
function ledger(now: { value: number }): PlannerLedger {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-task-planner-'))
  dirs.push(dir)
  return new PlannerLedger(dir, () => now.value)
}
const options = { timeZone: 'UTC', missedReminderHours: 24 }

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('Host task ledger', () => {
  it('persists atomically, advances repeats, and undoes completion as one change', () => {
    const now = { value: Date.parse('2026-08-25T09:00:00Z') }
    const store = ledger(now)
    const created = store.apply('request-create', 0, { kind: 'create', id: 'task-1', input: { title: 'Daily review', scheduledDate: '2026-08-25', repeat: { frequency: 'daily', interval: 1 } } }, options)
    expect(created.revision).toBe(1)
    now.value += 1000
    const completed = store.apply('request-complete', 1, { kind: 'complete', taskId: 'task-1' }, options)
    expect(completed.tasks).toHaveLength(2)
    expect(completed.tasks.find(task => task.status === 'open')?.scheduledDate).toBe('2026-08-26')
    expect(completed.undoToken).toBeTypeOf('string')
    now.value += 1000
    const undone = store.apply('request-undo', completed.revision, { kind: 'undo', token: completed.undoToken! }, options)
    expect(undone.tasks).toEqual([expect.objectContaining({ id: 'task-1', status: 'open', scheduledDate: '2026-08-25' })])
    expect(existsSync(store.file)).toBe(true)
    expect(JSON.parse(readFileSync(store.file, 'utf8')).revision).toBe(3)
    expect(readdirSync(join(store.file, '..')).some(name => name.includes('.tmp-'))).toBe(false)
  })

  it('rejects stale revisions and conflicting undo after another-tab edits', () => {
    const now = { value: 1000 }
    const store = ledger(now)
    store.apply('request-create', 0, { kind: 'create', id: 'task-1', input: { title: 'One', scheduledDate: '2026-08-25' } }, options)
    expect(() => store.apply('request-stale', 0, { kind: 'delete', taskId: 'task-1' }, options)).toThrow('revision conflict')
    now.value += 1
    const rescheduled = store.apply('request-move', 1, { kind: 'update', taskId: 'task-1', patch: { scheduledDate: '2026-08-26' } }, options)
    now.value += 1
    store.apply('request-title', 2, { kind: 'update', taskId: 'task-1', patch: { title: 'Changed elsewhere' } }, options)
    expect(() => store.apply('request-undo', 3, { kind: 'undo', token: rescheduled.undoToken! }, options)).toThrow('undo conflict')
  })

  it('quarantines corrupt data and starts with a valid empty ledger', () => {
    const now = { value: 1000 }
    const store = ledger(now)
    const dir = join(store.file, '..')
    writeFileSync(store.file, '{broken json', 'utf8')
    const recovered = new PlannerLedger(dir, () => now.value)
    expect(recovered.state()).toMatchObject({ revision: 0, tasks: [] })
    expect(readdirSync(dir).some(name => name.includes('.corrupt-') && name.endsWith('.backup.json'))).toBe(true)
  })

  it('grants a due reminder once and supports a persisted snooze', () => {
    const now = { value: Date.parse('2026-08-25T10:01:00Z') }
    const store = ledger(now)
    store.apply('request-create', 0, { kind: 'create', id: 'task-1', input: { title: 'Stand up', scheduledDate: '2026-08-25', scheduledTime: '10:00', reminder: { enabled: true, minutesBefore: 0 } } }, options)
    const first = store.apply('request-claim-1', 1, { kind: 'claim-reminder', taskId: 'task-1', now: now.value }, options)
    expect(first.reminderClaim).toMatchObject({ taskId: 'task-1', missed: false })
    const second = store.apply('request-claim-2', undefined, { kind: 'claim-reminder', taskId: 'task-1', now: now.value }, options)
    expect(second.reminderClaim).toBeUndefined()
    now.value += 1000
    const snoozed = store.apply('request-snooze', second.revision, { kind: 'snooze', taskId: 'task-1', until: now.value + 600_000 }, options)
    expect(snoozed.tasks[0].reminder?.snoozedUntil).toBe(now.value + 600_000)
  })
})
