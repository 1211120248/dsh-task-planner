export const TASK_SCHEMA_VERSION = 1 as const

export type TaskStatus = 'open' | 'completed'
export type TaskPriority = 'none' | 'low' | 'medium' | 'high'
export type TaskList = 'work' | 'personal'
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly'
export type PlannerView = 'today' | 'inbox' | 'upcoming' | 'completed' | TaskList

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface RepeatRule {
  frequency: RepeatFrequency
  interval: number
}

export interface TaskReminder {
  enabled: boolean
  minutesBefore: number
  lastNotifiedAt?: number
  snoozedUntil?: number
}

export interface Task {
  id: string
  title: string
  note: string
  checklist: ChecklistItem[]
  priority: TaskPriority
  list: TaskList
  status: TaskStatus
  scheduledDate?: string
  scheduledTime?: string
  reminder?: TaskReminder
  repeat?: RepeatRule
  seriesId?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface TaskInput {
  title: string
  note?: string
  checklist?: ChecklistItem[]
  priority?: TaskPriority
  list?: TaskList
  scheduledDate?: string
  scheduledTime?: string
  reminder?: Pick<TaskReminder, 'enabled' | 'minutesBefore'>
  repeat?: RepeatRule
}

export type TaskPatch = Partial<Omit<TaskInput, 'title'>> & { title?: string }

export interface PlannerState {
  schemaVersion: typeof TASK_SCHEMA_VERSION
  revision: number
  tasks: Task[]
  timeZone: string
  updatedAt: number
}

export interface ReminderClaim {
  taskId: string
  title: string
  dueAt: number
  claimedAt: number
  missed: boolean
}

export interface PlannerSettings {
  enabled: boolean
  notificationsEnabled: boolean
  timeZone: string
  agentToolsEnabled: boolean
  announceToAgent: boolean
  missedReminderHours: number
  snoozeMinutes: number
}
