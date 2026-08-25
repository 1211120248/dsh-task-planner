import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { Config } from '../index.ts'
import { SidebarEntry } from './SidebarEntry.tsx'
import { SettingsCard } from './SettingsCard.tsx'
import { TaskPlannerOverlay } from './TaskPlanner.tsx'
import { PlannerUiController } from './controller.ts'
import { en, zh, type TaskPlannerKey } from './locales.ts'

const NS = 'task-planner'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'task-planner': TaskPlannerKey
  }

  interface SlotMap {
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: { wide: boolean } }
    'shell.overlay': { kind: 'list'; scope: 'root'; owner: { children?: never } }
  }
}

export const inject = ['slots', 'locale', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-planner: locale dictionaries')
  const settingsScope = ctx.settingsScope.bind<Config>({ namespace: NS })
  const planner = new PlannerUiController()

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'task-planner',
    order: 120,
    label: () => ctx.locale.bind(NS)('settings.title'),
    locale: NS,
    inject: () => ({ settingsScope }),
  }, SettingsCard))

  let disposeUi: (() => void) | undefined
  const mountUi = (): void => {
    if (disposeUi !== undefined) return
    const disposers: Array<() => void> = []
    disposers.push(ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'task-planner',
      order: 80,
      locale: NS,
      inject: () => ({ planner }),
    }, SidebarEntry)))
    disposers.push(ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'task-planner',
      order: 80,
      locale: NS,
      inject: () => ({ planner, settingsScope }),
    }, TaskPlannerOverlay)))
    disposeUi = () => { for (const dispose of disposers) dispose(); disposeUi = undefined }
  }

  const sync = (): void => {
    const snapshot = settingsScope.getSnapshot()
    const enabled = snapshot.status === 'ready' ? snapshot.value?.enabled ?? true : snapshot.status === 'unavailable'
    if (enabled) mountUi()
    else { planner.close(); disposeUi?.() }
  }
  const unsubscribe = settingsScope.subscribe(sync)
  ctx.effect(() => () => { unsubscribe(); disposeUi?.() }, 'task-planner: settings and slots')
  sync()
}
