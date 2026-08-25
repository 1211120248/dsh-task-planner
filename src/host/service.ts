import type { PlannerSettings, PlannerState, Task } from '../core/types.ts'
import type { PlannerAction, PlannerResponse } from '../protocol.ts'
import { PlannerLedger } from './ledger.ts'

export class TaskPlannerService {
  constructor(
    readonly ledger = new PlannerLedger(),
    private settings: PlannerSettings,
  ) {}

  configure(settings: PlannerSettings): void {
    this.settings = settings
  }

  configuration(): PlannerSettings {
    return { ...this.settings }
  }

  state(): PlannerState {
    return this.ledger.state(this.settings.timeZone)
  }

  apply(requestId: string, baseRevision: number | undefined, action: PlannerAction): PlannerResponse {
    return this.ledger.apply(requestId, baseRevision, action, {
      timeZone: this.settings.timeZone,
      missedReminderHours: this.settings.missedReminderHours,
    })
  }

  query(filter: {
    id?: string
    search?: string
    status?: 'open' | 'completed' | 'all'
    list?: 'work' | 'personal'
    scheduledDate?: string
    before?: string
    after?: string
  }): Task[] {
    const needle = filter.search?.trim().toLocaleLowerCase()
    return this.state().tasks.filter(task => {
      if (filter.id !== undefined && task.id !== filter.id) return false
      if (filter.status !== undefined && filter.status !== 'all' && task.status !== filter.status) return false
      if (filter.list !== undefined && task.list !== filter.list) return false
      if (filter.scheduledDate !== undefined && task.scheduledDate !== filter.scheduledDate) return false
      if (filter.before !== undefined && (task.scheduledDate === undefined || task.scheduledDate >= filter.before)) return false
      if (filter.after !== undefined && (task.scheduledDate === undefined || task.scheduledDate <= filter.after)) return false
      if (needle !== undefined && needle !== '' && !`${task.title} ${task.note} ${task.checklist.map(item => item.text).join(' ')}`.toLocaleLowerCase().includes(needle)) return false
      return true
    })
  }

  resolveTask(reference: { taskId?: string; title?: string }): Task {
    if (reference.taskId !== undefined) {
      const task = this.state().tasks.find(item => item.id === reference.taskId)
      if (task === undefined) throw new Error(`task not found: ${reference.taskId}`)
      return task
    }
    const title = reference.title?.trim()
    if (title === undefined || title === '') throw new Error('taskId or title is required')
    const exact = this.state().tasks.filter(task => task.title.toLocaleLowerCase() === title.toLocaleLowerCase())
    const matches = exact.length > 0 ? exact : this.state().tasks.filter(task => task.title.toLocaleLowerCase().includes(title.toLocaleLowerCase()))
    if (matches.length === 0) throw new Error(`no task matches title: ${title}`)
    if (matches.length > 1) {
      const choices = matches.slice(0, 12).map(task => `${task.id} | ${task.title} | ${task.scheduledDate ?? 'inbox'} | ${task.status}`).join('\n')
      throw new Error(`ambiguous task title; choose one taskId:\n${choices}`)
    }
    return matches[0]
  }
}
