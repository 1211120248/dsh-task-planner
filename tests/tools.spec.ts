import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { PlannerLedger } from '../src/host/ledger.ts'
import { TaskPlannerService } from '../src/host/service.ts'
import { taskPlannerTools } from '../src/host/tools.ts'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

function service(): TaskPlannerService {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-task-planner-tools-'))
  dirs.push(dir)
  return new TaskPlannerService(new PlannerLedger(dir), { enabled: true, notificationsEnabled: true, timeZone: 'local', agentToolsEnabled: true, announceToAgent: false, missedReminderHours: 24, snoozeMinutes: 10 })
}

describe('Agent tools', () => {
  it('registers only the bounded task-management surface', () => {
    expect(taskPlannerTools(service()).map(tool => tool.name)).toEqual([
      'task_planner_query',
      'task_planner_create',
      'task_planner_update',
      'task_planner_complete',
      'task_planner_delete',
    ])
  })

  it('refuses deletion without an explicit confirmation flag', async () => {
    const planner = service()
    planner.apply('create-delete-target', 0, { kind: 'create', id: 'target', input: { title: 'Delete me' } })
    const deletion = taskPlannerTools(planner).find(tool => tool.name === 'task_planner_delete')
    expect(deletion).toBeDefined()
    const exec = {
      callId: 'test-call',
      rootCallId: 'test-call',
      name: 'task_planner_delete',
      arguments: { taskId: 'target', confirm: false },
      signal: new AbortController().signal,
      token: Symbol('test-tool-token'),
      deferContext() {},
      concludeTurn() {},
    } as unknown as ToolRunContext
    const result = await deletion!.execute({ taskId: 'target', confirm: false }, exec) as { text: string }
    expect(result.text).toMatch(/Confirmation required/)
    expect(planner.state().tasks.map(task => task.id)).toContain('target')
  })
})
