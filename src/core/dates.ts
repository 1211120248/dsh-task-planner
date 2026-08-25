import type { PlannerView, RepeatRule, Task } from './types.ts'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isDate(value: string | undefined): value is string {
  if (value === undefined || !DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isTime(value: string | undefined): value is string {
  return value !== undefined && TIME_PATTERN.test(value)
}

export function localDateKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function nextRepeatDate(date: string, rule: RepeatRule): string {
  const [year, month, day] = date.split('-').map(Number)
  const interval = Math.max(1, Math.trunc(rule.interval))
  if (rule.frequency === 'monthly') {
    const target = new Date(Date.UTC(year, month - 1 + interval, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(day, lastDay))
    return target.toISOString().slice(0, 10)
  }
  const dateValue = new Date(Date.UTC(year, month - 1, day))
  dateValue.setUTCDate(dateValue.getUTCDate() + interval * (rule.frequency === 'weekly' ? 7 : 1))
  return dateValue.toISOString().slice(0, 10)
}

function zoneParts(epoch: number, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(epoch)
  return Object.fromEntries(parts.flatMap(part => part.type === 'literal' ? [] : [[part.type, Number(part.value)]]))
}

export function zonedDateTimeToEpoch(date: string, time: string, timeZone: string): number | undefined {
  if (!isDate(date) || !isTime(time)) return undefined
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  if (timeZone === 'local') return new Date(year, month - 1, day, hour, minute).getTime()
  try {
    let guess = desired
    for (let pass = 0; pass < 3; pass += 1) {
      const current = zoneParts(guess, timeZone)
      const represented = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute, current.second)
      const delta = desired - represented
      guess += delta
      if (Math.abs(delta) < 1000) break
    }
    return guess
  } catch {
    return undefined
  }
}

export function reminderDueAt(task: Task, timeZone: string): number | undefined {
  if (task.status !== 'open' || task.reminder?.enabled !== true || task.scheduledDate === undefined || task.scheduledTime === undefined) return undefined
  if (task.reminder.snoozedUntil !== undefined && (task.reminder.lastNotifiedAt ?? 0) < task.reminder.snoozedUntil) return task.reminder.snoozedUntil
  const scheduled = zonedDateTimeToEpoch(task.scheduledDate, task.scheduledTime, timeZone)
  return scheduled === undefined ? undefined : scheduled - task.reminder.minutesBefore * 60_000
}

export function compareTasks(a: Task, b: Task): number {
  const aKey = `${a.scheduledDate ?? '9999-99-99'}T${a.scheduledTime ?? '99:99'}`
  const bKey = `${b.scheduledDate ?? '9999-99-99'}T${b.scheduledTime ?? '99:99'}`
  const bySchedule = aKey.localeCompare(bKey)
  if (bySchedule !== 0) return bySchedule
  const priority = { high: 0, medium: 1, low: 2, none: 3 }
  return priority[a.priority] - priority[b.priority] || a.createdAt - b.createdAt
}

export function tasksForView(tasks: readonly Task[], view: PlannerView, today: string, query = ''): Task[] {
  const needle = query.trim().toLocaleLowerCase()
  return tasks.filter(task => {
    if (view === 'today' && !(task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate <= today)) return false
    if (view === 'inbox' && !(task.status === 'open' && task.scheduledDate === undefined)) return false
    if (view === 'upcoming' && !(task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate > today)) return false
    if (view === 'completed' && task.status !== 'completed') return false
    if ((view === 'work' || view === 'personal') && !(task.status === 'open' && task.list === view)) return false
    if (needle === '') return true
    return `${task.title} ${task.note} ${task.list} ${task.checklist.map(item => item.text).join(' ')}`.toLocaleLowerCase().includes(needle)
  }).sort(view === 'completed'
    ? (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
    : compareTasks)
}
