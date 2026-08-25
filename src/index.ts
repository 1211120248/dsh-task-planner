import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type { PlannerSettings } from './core/types.ts'
import { mountOnce } from './host/mount-once.ts'
import { taskPlannerRoutes } from './host/routes.ts'
import { TaskPlannerService } from './host/service.ts'
import { taskPlannerTools } from './host/tools.ts'

export const TASK_PLANNER_SETTINGS_NAMESPACE = settingsNamespace('task-planner')

export interface Config {
  enabled?: boolean
  notificationsEnabled?: boolean
  timeZone?: string
  agentToolsEnabled?: boolean
  announceToAgent?: boolean
  missedReminderHours?: number
  snoozeMinutes?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  notificationsEnabled: z.boolean().default(true),
  timeZone: z.string().min(1).default('local'),
  agentToolsEnabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
  missedReminderHours: z.number().min(1).max(168).step(1).default(24),
  snoozeMinutes: z.number().min(1).max(1_440).step(1).default(10),
})

export const inject = ['webServer', 'tools', 'systemPrompt']

export const TASK_PLANNER_GUIDANCE = [
  '本机已安装 dsh-task-planner 日常任务插件。可通过 task_planner_query/create/update/complete/delete 管理本机任务。',
  '当用户要求记录、安排或提醒，或者陈述明确且可执行的未来个人安排（例如“明天去北京”“周五交报告”）时，应调用 task_planner_create；讨论、假设和普通问句不要自动创建任务。',
  '创建成功后必须明确告诉用户已记录的标题、日期、时间和提醒状态，并说明可在“任务计划”中查看，不能只回复“好的”。',
  '如果只有日期而没有具体时间，先记录日期，再明确说明尚未设置定时提醒并询问几点提醒；绝不能声称已经设置提醒。用户给出日期和时间且明确要求提醒时，未指定提前量则使用 reminderMinutesBefore=0。',
  '同名任务必须先查询并用 taskId 消歧；删除必须获得用户明确确认并传 confirm=true。',
  '提醒只在 DSH Web GUI 运行且浏览器能够调度时触发，不承诺 DSH 关闭、系统休眠或浏览器冻结期间准时通知。',
].join('\n')

function resolve(config: Config): PlannerSettings {
  return {
    enabled: config.enabled ?? true,
    notificationsEnabled: config.notificationsEnabled ?? true,
    timeZone: config.timeZone?.trim() || 'local',
    agentToolsEnabled: config.agentToolsEnabled ?? true,
    announceToAgent: config.announceToAgent ?? true,
    missedReminderHours: Math.max(1, Math.min(168, Math.trunc(config.missedReminderHours ?? 24))),
    snoozeMinutes: Math.max(1, Math.min(1_440, Math.trunc(config.snoozeMinutes ?? 10))),
  }
}

export const apply = mountOnce('dsh-task-planner', applyImpl)

function applyImpl(ctx: Context, config: Config = {}): void {
  let source = (): Config => config
  const service = new TaskPlannerService(undefined, resolve(config))
  const routes = taskPlannerRoutes(service)
  ctx.effect(() => {
    const disposers = routes.map(route => ctx.webServer.register(route))
    return () => { for (const dispose of disposers) dispose() }
  }, 'task-planner: Host routes and ledger')

  let disposeTools: (() => void) | undefined
  let disposeAnnouncement: (() => void) | undefined
  const sync = (): void => {
    const settings = resolve(source())
    service.configure(settings)
    disposeTools?.()
    disposeTools = undefined
    disposeAnnouncement?.()
    disposeAnnouncement = undefined
    if (settings.enabled && settings.agentToolsEnabled) {
      const disposers = taskPlannerTools(service).map(tool => ctx.tools.register(tool))
      disposeTools = () => { for (const dispose of disposers) dispose() }
    }
    if (settings.enabled && settings.announceToAgent) {
      disposeAnnouncement = ctx.systemPrompt.section({ name: 'plugin:task-planner', order: 205, text: TASK_PLANNER_GUIDANCE })
    }
  }

  installSettingsSection(ctx, TASK_PLANNER_SETTINGS_NAMESPACE, Config, config, {
    setSource(next) { source = next },
    onChange: sync,
    validate(value) {
      const zone = value.timeZone?.trim()
      if (zone !== undefined && zone !== '' && zone !== 'local') new Intl.DateTimeFormat('en', { timeZone: zone }).format()
    },
  })
  sync()
  ctx.effect(() => () => { disposeTools?.(); disposeAnnouncement?.() }, 'task-planner: tools and announcement')
}
