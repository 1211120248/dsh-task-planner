import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isDate, isTime, nextRepeatDate, reminderDueAt } from '../core/dates.ts'
import { TASK_SCHEMA_VERSION, type ChecklistItem, type PlannerState, type ReminderClaim, type Task, type TaskInput, type TaskPatch } from '../core/types.ts'
import type { PlannerAction, PlannerResponse } from '../protocol.ts'
import { resolveDshHome } from './dsh-home.ts'

const UNDO_WINDOW_MS = 8_000
const MAX_REQUESTS = 256
const MAX_TASKS = 20_000
const MAX_TITLE = 500
const MAX_NOTE = 40_000
const MAX_CHECKLIST = 500

interface LedgerDocument extends PlannerState {
  recentRequests: Array<{ requestId: string; fingerprint: string }>
}

interface UndoRecord {
  expiresAt: number
  before: Task[]
  expected: Array<{ id: string; updatedAt?: number }>
}

interface ApplyOptions {
  timeZone: string
  missedReminderHours: number
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function string(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function checklist(values: unknown): ChecklistItem[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  return values.slice(0, MAX_CHECKLIST).flatMap((value, index) => {
    if (typeof value !== 'object' || value === null) return []
    const row = value as Record<string, unknown>
    const text = string(row.text, 2_000)
    if (text === '') return []
    let id = string(row.id, 160, `item-${index + 1}`)
    if (seen.has(id)) id = `${id}-${index + 1}`
    seen.add(id)
    return [{ id, text, completed: row.completed === true }]
  })
}

function normalizeTask(value: unknown): Task | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const id = string(row.id, 160)
  const title = string(row.title, MAX_TITLE)
  if (id === '' || title === '') return undefined
  const scheduledDate = typeof row.scheduledDate === 'string' && isDate(row.scheduledDate) ? row.scheduledDate : undefined
  const scheduledTime = typeof row.scheduledTime === 'string' && isTime(row.scheduledTime) ? row.scheduledTime : undefined
  const reminderRow = typeof row.reminder === 'object' && row.reminder !== null ? row.reminder as Record<string, unknown> : undefined
  const repeatRow = typeof row.repeat === 'object' && row.repeat !== null ? row.repeat as Record<string, unknown> : undefined
  const priority = row.priority === 'low' || row.priority === 'medium' || row.priority === 'high' ? row.priority : 'none'
  const list = row.list === 'personal' ? 'personal' : 'work'
  const status = row.status === 'completed' ? 'completed' : 'open'
  const createdAt = typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : Date.now()
  const updatedAt = typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : createdAt
  const repeatFrequency = repeatRow?.frequency
  return {
    id,
    title,
    note: string(row.note, MAX_NOTE),
    checklist: checklist(row.checklist),
    priority,
    list,
    status,
    ...(scheduledDate === undefined ? {} : { scheduledDate }),
    ...(scheduledTime === undefined || scheduledDate === undefined ? {} : { scheduledTime }),
    ...(reminderRow?.enabled === true && scheduledDate !== undefined && scheduledTime !== undefined
      ? { reminder: {
          enabled: true,
          minutesBefore: typeof reminderRow.minutesBefore === 'number' && Number.isFinite(reminderRow.minutesBefore)
            ? Math.max(0, Math.min(43_200, Math.trunc(reminderRow.minutesBefore)))
            : 0,
          ...(typeof reminderRow.lastNotifiedAt === 'number' ? { lastNotifiedAt: reminderRow.lastNotifiedAt } : {}),
          ...(typeof reminderRow.snoozedUntil === 'number' ? { snoozedUntil: reminderRow.snoozedUntil } : {}),
        } }
      : {}),
    ...(repeatFrequency === 'daily' || repeatFrequency === 'weekly' || repeatFrequency === 'monthly'
      ? { repeat: { frequency: repeatFrequency, interval: typeof repeatRow?.interval === 'number' ? Math.max(1, Math.min(365, Math.trunc(repeatRow.interval))) : 1 } }
      : {}),
    ...(typeof row.seriesId === 'string' && row.seriesId !== '' ? { seriesId: row.seriesId.slice(0, 160) } : {}),
    createdAt,
    updatedAt,
    ...(status === 'completed' && typeof row.completedAt === 'number' ? { completedAt: row.completedAt } : {}),
  }
}

function taskFromInput(input: TaskInput, id: string, now: number): Task {
  const task = normalizeTask({
    ...input,
    id,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  })
  if (task === undefined) throw new Error('task title is required')
  return task
}

function mergePatch(task: Task, patch: TaskPatch, now: number): Task {
  const merged = normalizeTask({
    ...task,
    ...patch,
    id: task.id,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: now,
    completedAt: task.completedAt,
    reminder: patch.reminder === undefined
      ? task.reminder
      : patch.reminder.enabled
        ? { ...task.reminder, ...patch.reminder, lastNotifiedAt: undefined, snoozedUntil: undefined }
        : undefined,
  })
  if (merged === undefined) throw new Error('task title is required')
  return merged
}

function fingerprint(action: PlannerAction): string {
  return JSON.stringify(action)
}

function expectedFor(tasks: readonly Task[]): Array<{ id: string; updatedAt: number }> {
  return tasks.map(task => ({ id: task.id, updatedAt: task.updatedAt }))
}

export class PlannerLedger {
  readonly file: string
  private document: LedgerDocument
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, string>()
  private readonly undo = new Map<string, UndoRecord>()

  constructor(
    dir = join(resolveDshHome(), 'task-planner'),
    private readonly now: () => number = Date.now,
  ) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'tasks-v1.json')
    this.document = this.load()
    for (const request of this.document.recentRequests) this.requests.set(request.requestId, request.fingerprint)
    this.commit(false)
  }

  state(timeZone = 'local'): PlannerState {
    return {
      schemaVersion: TASK_SCHEMA_VERSION,
      revision: this.document.revision,
      tasks: clone(this.document.tasks),
      timeZone,
      updatedAt: this.document.updatedAt,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  apply(requestId: string, baseRevision: number | undefined, action: PlannerAction, options: ApplyOptions): PlannerResponse {
    this.purgeUndo()
    const actionFingerprint = fingerprint(action)
    const previous = this.requests.get(requestId)
    if (previous !== undefined) {
      if (previous !== actionFingerprint) throw new Error('request id was already used for a different action')
      return this.state(options.timeZone)
    }
    if (action.kind !== 'claim-reminder' && baseRevision !== undefined && baseRevision !== this.document.revision) {
      throw new Error(`revision conflict: expected ${baseRevision}, current ${this.document.revision}`)
    }

    const now = this.now()
    let undoToken: string | undefined
    let reminderClaim: ReminderClaim | undefined
    const before = clone(this.document.tasks)
    const taskIndex = 'taskId' in action ? this.document.tasks.findIndex(task => task.id === action.taskId) : -1
    const current = taskIndex < 0 ? undefined : this.document.tasks[taskIndex]

    switch (action.kind) {
      case 'create': {
        const id = action.id ?? crypto.randomUUID()
        if (this.document.tasks.some(task => task.id === id)) throw new Error('task id already exists')
        this.document.tasks.push(taskFromInput(action.input, id, now))
        break
      }
      case 'update': {
        if (current === undefined) throw new Error('task not found')
        const next = mergePatch(current, action.patch, now)
        this.document.tasks[taskIndex] = next
        if (current.scheduledDate !== next.scheduledDate || current.scheduledTime !== next.scheduledTime) {
          undoToken = this.rememberUndo([current], expectedFor([next]))
        }
        break
      }
      case 'delete': {
        if (current === undefined) throw new Error('task not found')
        this.document.tasks.splice(taskIndex, 1)
        undoToken = this.rememberUndo([current], [{ id: current.id }])
        break
      }
      case 'complete': {
        if (current === undefined) throw new Error('task not found')
        if (current.status === 'completed') throw new Error('task is already completed')
        const completed: Task = { ...current, status: 'completed', completedAt: now, updatedAt: now, reminder: current.reminder === undefined ? undefined : { ...current.reminder, enabled: false } }
        this.document.tasks[taskIndex] = completed
        const affected = [completed]
        if (current.repeat !== undefined && current.scheduledDate !== undefined) {
          const id = crypto.randomUUID()
          const next: Task = {
            ...current,
            id,
            status: 'open',
            scheduledDate: nextRepeatDate(current.scheduledDate, current.repeat),
            seriesId: current.seriesId ?? current.id,
            createdAt: now,
            updatedAt: now,
            completedAt: undefined,
            reminder: current.reminder === undefined ? undefined : { ...current.reminder, lastNotifiedAt: undefined, snoozedUntil: undefined },
          }
          this.document.tasks.push(next)
          affected.push(next)
        }
        undoToken = this.rememberUndo([current], expectedFor(affected))
        break
      }
      case 'restore': {
        if (current === undefined) throw new Error('task not found')
        if (current.status !== 'completed') throw new Error('task is not completed')
        const restored: Task = { ...current, status: 'open', completedAt: undefined, updatedAt: now }
        this.document.tasks[taskIndex] = restored
        undoToken = this.rememberUndo([current], expectedFor([restored]))
        break
      }
      case 'undo': {
        const record = this.undo.get(action.token)
        if (record === undefined || record.expiresAt < now) throw new Error('undo expired')
        for (const expected of record.expected) {
          const actual = this.document.tasks.find(task => task.id === expected.id)
          if (expected.updatedAt === undefined ? actual !== undefined : actual?.updatedAt !== expected.updatedAt) {
            throw new Error('undo conflict: task changed in another tab')
          }
        }
        const affectedIds = new Set(record.expected.map(item => item.id))
        this.document.tasks = this.document.tasks.filter(task => !affectedIds.has(task.id))
        for (const task of record.before) this.document.tasks.push(task)
        this.undo.delete(action.token)
        break
      }
      case 'claim-reminder': {
        if (current === undefined) throw new Error('task not found')
        const dueAt = reminderDueAt(current, options.timeZone)
        if (dueAt === undefined || action.now < dueAt) break
        if (action.now - dueAt > options.missedReminderHours * 3_600_000) break
        if ((current.reminder?.lastNotifiedAt ?? 0) >= dueAt) break
        const claimed: Task = {
          ...current,
          updatedAt: now,
          reminder: { ...current.reminder!, lastNotifiedAt: action.now, snoozedUntil: undefined },
        }
        this.document.tasks[taskIndex] = claimed
        reminderClaim = { taskId: current.id, title: current.title, dueAt, claimedAt: action.now, missed: action.now - dueAt > 60_000 }
        break
      }
      case 'snooze': {
        if (current === undefined || current.reminder === undefined) throw new Error('task reminder not found')
        if (!Number.isFinite(action.until) || action.until <= now || action.until > now + 7 * 86_400_000) throw new Error('invalid snooze time')
        this.document.tasks[taskIndex] = { ...current, updatedAt: now, reminder: { ...current.reminder, enabled: true, snoozedUntil: action.until } }
        break
      }
      case 'import': {
        const incoming = action.tasks.slice(0, MAX_TASKS).flatMap(value => {
          const task = normalizeTask(value)
          return task === undefined ? [] : [task]
        })
        if (action.mode === 'replace') {
          this.backup('before-import')
          this.document.tasks = incoming
        } else {
          const byId = new Map(this.document.tasks.map(task => [task.id, task]))
          for (const task of incoming) {
            const previousTask = byId.get(task.id)
            if (previousTask === undefined || task.updatedAt > previousTask.updatedAt) byId.set(task.id, task)
          }
          this.document.tasks = [...byId.values()]
        }
        break
      }
    }

    if (this.document.tasks.length > MAX_TASKS) {
      this.document.tasks = before
      throw new Error(`task limit exceeded (${MAX_TASKS})`)
    }
    this.rememberRequest(requestId, actionFingerprint)
    this.commit()
    const response: PlannerResponse = {
      ...this.state(options.timeZone),
      ...(undoToken === undefined ? {} : { undoToken, undoExpiresAt: now + UNDO_WINDOW_MS }),
      ...(reminderClaim === undefined ? {} : { reminderClaim }),
    }
    return response
  }

  backup(label = 'manual'): string {
    const target = `${this.file}.${label}-${this.now()}.backup.json`
    writeFileSync(target, JSON.stringify(this.document, null, 2), { encoding: 'utf8', mode: 0o600 })
    return target
  }

  private rememberUndo(before: Task[], expected: UndoRecord['expected']): string {
    const token = crypto.randomUUID()
    this.undo.set(token, { before: clone(before), expected, expiresAt: this.now() + UNDO_WINDOW_MS })
    return token
  }

  private purgeUndo(): void {
    const now = this.now()
    for (const [token, record] of this.undo) if (record.expiresAt < now) this.undo.delete(token)
  }

  private rememberRequest(requestId: string, value: string): void {
    this.requests.set(requestId, value)
    while (this.requests.size > MAX_REQUESTS) this.requests.delete(this.requests.keys().next().value as string)
    this.document.recentRequests = [...this.requests].map(([id, requestFingerprint]) => ({ requestId: id, fingerprint: requestFingerprint }))
  }

  private load(): LedgerDocument {
    const existed = existsSync(this.file)
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<LedgerDocument>
      if (parsed.schemaVersion !== TASK_SCHEMA_VERSION || !Array.isArray(parsed.tasks)) throw new Error('unsupported task ledger schema')
      return {
        schemaVersion: TASK_SCHEMA_VERSION,
        revision: Number.isSafeInteger(parsed.revision) && (parsed.revision as number) >= 0 ? parsed.revision as number : 0,
        tasks: parsed.tasks.slice(0, MAX_TASKS).flatMap(value => {
          const task = normalizeTask(value)
          return task === undefined ? [] : [task]
        }),
        timeZone: 'local',
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : this.now(),
        recentRequests: Array.isArray(parsed.recentRequests)
          ? parsed.recentRequests.flatMap(value => typeof value?.requestId === 'string' && typeof value.fingerprint === 'string' ? [value] : []).slice(-MAX_REQUESTS)
          : [],
      }
    } catch (error) {
      if (existed) renameSync(this.file, `${this.file}.corrupt-${this.now()}-${crypto.randomUUID()}.backup.json`)
      return {
        schemaVersion: TASK_SCHEMA_VERSION,
        revision: 0,
        tasks: [],
        timeZone: 'local',
        updatedAt: this.now(),
        recentRequests: [],
      }
    }
  }

  private commit(bump = true): void {
    if (bump) this.document.revision += 1
    this.document.updatedAt = this.now()
    mkdirSync(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.tmp-${process.pid}`
    let descriptor: number | undefined
    try {
      descriptor = openSync(temporary, 'w', 0o600)
      writeFileSync(descriptor, `${JSON.stringify(this.document, null, 2)}\n`, 'utf8')
      fsyncSync(descriptor)
      closeSync(descriptor)
      descriptor = undefined
      try { chmodSync(temporary, 0o600) } catch { /* Windows ACLs own access. */ }
      renameSync(temporary, this.file)
      try {
        const directory = openSync(dirname(this.file), 'r')
        try { fsyncSync(directory) } finally { closeSync(directory) }
      } catch { /* Windows cannot fsync directory handles. */ }
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor)
      try { unlinkSync(temporary) } catch { /* Best-effort temporary cleanup. */ }
      throw error
    }
    for (const listener of [...this.listeners]) listener()
  }
}

export const plannerLimits = {
  maxTasks: MAX_TASKS,
  maxTitle: MAX_TITLE,
  maxNote: MAX_NOTE,
  maxChecklist: MAX_CHECKLIST,
  undoWindowMs: UNDO_WINDOW_MS,
} as const
