import type { PlannerState, ReminderClaim, Task, TaskInput, TaskPatch } from './core/types.ts'

export const API_PREFIX = '/api/task-planner'

export type PlannerAction =
  | { kind: 'create'; input: TaskInput; id?: string }
  | { kind: 'update'; taskId: string; patch: TaskPatch }
  | { kind: 'delete'; taskId: string }
  | { kind: 'complete'; taskId: string }
  | { kind: 'restore'; taskId: string }
  | { kind: 'undo'; token: string }
  | { kind: 'claim-reminder'; taskId: string; now: number }
  | { kind: 'snooze'; taskId: string; until: number }
  | { kind: 'import'; mode: 'merge' | 'replace'; tasks: Task[] }

export interface PlannerActionEnvelope {
  requestId: string
  baseRevision?: number
  action: PlannerAction
}

export interface PlannerResponse extends PlannerState {
  undoToken?: string
  undoExpiresAt?: number
  reminderClaim?: ReminderClaim
}

export interface PlannerEvent {
  revision: number
  updatedAt: number
}

export function parseEnvelope(value: unknown): PlannerActionEnvelope | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  if (typeof row.requestId !== 'string' || row.requestId.length < 8 || row.requestId.length > 160) return undefined
  if (row.baseRevision !== undefined && (!Number.isSafeInteger(row.baseRevision) || (row.baseRevision as number) < 0)) return undefined
  if (typeof row.action !== 'object' || row.action === null) return undefined
  const action = row.action as Record<string, unknown>
  const taskReference = (): boolean => typeof action.taskId === 'string' && action.taskId.length > 0 && action.taskId.length <= 160
  switch (action.kind) {
    case 'create':
      if (typeof action.input !== 'object' || action.input === null || action.id !== undefined && typeof action.id !== 'string') return undefined
      break
    case 'update':
      if (!taskReference() || typeof action.patch !== 'object' || action.patch === null) return undefined
      break
    case 'delete':
    case 'complete':
    case 'restore':
      if (!taskReference()) return undefined
      break
    case 'undo':
      if (typeof action.token !== 'string' || action.token.length === 0 || action.token.length > 160) return undefined
      break
    case 'claim-reminder':
      if (!taskReference() || typeof action.now !== 'number' || !Number.isFinite(action.now)) return undefined
      break
    case 'snooze':
      if (!taskReference() || typeof action.until !== 'number' || !Number.isFinite(action.until)) return undefined
      break
    case 'import':
      if (!(action.mode === 'merge' || action.mode === 'replace') || !Array.isArray(action.tasks)) return undefined
      break
    default:
      return undefined
  }
  return row as unknown as PlannerActionEnvelope
}
