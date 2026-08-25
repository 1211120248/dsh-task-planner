import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PlannerLedger } from '../src/host/ledger.ts'
import { TaskPlannerService } from '../src/host/service.ts'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function service(): TaskPlannerService {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-task-planner-service-'))
  dirs.push(dir)
  return new TaskPlannerService(new PlannerLedger(dir), { enabled: true, notificationsEnabled: true, timeZone: 'local', agentToolsEnabled: true, announceToAgent: false, missedReminderHours: 24, snoozeMinutes: 10 })
}

describe('Agent task resolution', () => {
  it('requires disambiguation for same-name tasks', () => {
    const planner = service()
    planner.apply('request-create-1', 0, { kind: 'create', id: 'one', input: { title: 'Weekly review' } })
    planner.apply('request-create-2', 1, { kind: 'create', id: 'two', input: { title: 'Weekly review' } })
    expect(() => planner.resolveTask({ title: 'Weekly review' })).toThrow(/ambiguous task title.*one.*two/s)
    expect(planner.resolveTask({ taskId: 'two' }).id).toBe('two')
  })

  it('searches notes and checklist text', () => {
    const planner = service()
    planner.apply('request-create', 0, { kind: 'create', id: 'one', input: { title: 'Release', note: 'npm package', checklist: [{ id: 'c1', text: 'Update changelog', completed: false }] } })
    expect(planner.query({ search: 'changelog' }).map(task => task.id)).toEqual(['one'])
  })
})
