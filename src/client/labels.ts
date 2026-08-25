import type { PlannerView } from '../core/types.ts'
import type { TaskPlannerKey } from './locales.ts'

const VIEW_KEYS = {
  today: 'view.today',
  inbox: 'view.inbox',
  upcoming: 'view.upcoming',
  completed: 'view.completed',
  work: 'view.work',
  personal: 'view.personal',
} as const satisfies Record<PlannerView, TaskPlannerKey>

const VIEW_HINT_KEYS = {
  today: 'view.todayHint',
  inbox: 'view.inboxHint',
  upcoming: 'view.upcomingHint',
  completed: 'view.completedHint',
  work: 'view.workHint',
  personal: 'view.personalHint',
} as const satisfies Record<PlannerView, TaskPlannerKey>

const STATIC_GROUP_KEYS = {
  overdue: 'section.overdue',
  today: 'section.today',
  inbox: 'section.inbox',
  completed: 'section.completed',
  work: 'view.work',
  personal: 'view.personal',
} as const satisfies Record<string, TaskPlannerKey>

export function viewKey(view: PlannerView): TaskPlannerKey { return VIEW_KEYS[view] }

export function viewHintKey(view: PlannerView): TaskPlannerKey { return VIEW_HINT_KEYS[view] }

/** Static group labels deliberately reuse the list names for Work and Personal. */
export function staticGroupLabelKey(group: string): TaskPlannerKey | undefined {
  return STATIC_GROUP_KEYS[group as keyof typeof STATIC_GROUP_KEYS]
}
