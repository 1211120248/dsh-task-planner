import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Task, TaskInput, TaskPatch } from '../core/types.ts'
import type { TaskPlannerService } from './service.ts'

function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

function renderTasks(tasks: readonly Task[]): string {
  if (tasks.length === 0) return 'No matching tasks.'
  return [
    'id | status | schedule | list | priority | title',
    '--- | --- | --- | --- | --- | ---',
    ...tasks.map(task => `${task.id} | ${task.status} | ${task.scheduledDate ?? 'inbox'}${task.scheduledTime ? ` ${task.scheduledTime}` : ''} | ${task.list} | ${task.priority} | ${task.title}`),
  ].join('\n')
}

function renderSchedule(task: Task): string {
  if (task.scheduledDate === undefined) return '未安排日期和时间'
  if (task.scheduledTime === undefined) return `${task.scheduledDate}（未设置具体时间）`
  return `${task.scheduledDate} ${task.scheduledTime}`
}

function renderReminder(task: Task): string {
  if (task.reminder?.enabled === true) {
    return task.reminder.minutesBefore === 0 ? '准时提醒' : `提前 ${task.reminder.minutesBefore} 分钟提醒`
  }
  if (task.scheduledDate !== undefined && task.scheduledTime === undefined) return '未设置；需要补充具体时间'
  if (task.scheduledDate === undefined) return '未设置；需要补充日期和时间'
  return '未设置'
}

function reference(service: TaskPlannerService, args: { taskId?: string; title?: string }): Task {
  return service.resolveTask(args)
}

const referenceParameters = {
  taskId: { type: 'string' as const, description: 'Exact task id. Prefer this after task_planner_query, especially when titles repeat.' },
  title: { type: 'string' as const, description: 'Title reference only when taskId is unknown. Ambiguous same-name matches are rejected with candidate ids.' },
}

function textOutput() {
  return {
    schema: {
      type: 'object' as const,
      additionalProperties: false as const,
      properties: {
        text: { type: 'string' as const, required: true as const },
      },
    },
    render: (_args: unknown, value: { text: string }) => text(value.text),
  }
}

export function taskPlannerTools(service: TaskPlannerService) {
  return [
    defineTool({
      name: 'task_planner_query',
      description: 'Query the local DSH daily task planner. Use before modifying a possibly duplicated title so the user can disambiguate by task id.',
      parameters: {
        search: { type: 'string', description: 'Search title, note, and checklist text.' },
        status: { type: 'string', enum: ['open', 'completed', 'all'], description: 'Task status (default all).' },
        list: { type: 'string', enum: ['work', 'personal'], description: 'Optional list filter.' },
        scheduledDate: { type: 'string', description: 'Exact YYYY-MM-DD date.' },
        before: { type: 'string', description: 'Only tasks scheduled before YYYY-MM-DD.' },
        after: { type: 'string', description: 'Only tasks scheduled after YYYY-MM-DD.' },
      },
      output: textOutput(),
      async execute(args) { return { text: renderTasks(service.query(args)) } },
    }),
    defineTool({
      name: 'task_planner_create',
      description: 'Create one local daily task when the user asks to record, arrange, or remember something, or states a concrete actionable future personal plan. Do not use for hypotheticals or ordinary questions. Dates use YYYY-MM-DD and times use 24-hour HH:mm. A reminder requires both date and time.',
      parameters: {
        title: { type: 'string', required: true },
        note: { type: 'string' },
        list: { type: 'string', enum: ['work', 'personal'] },
        priority: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
        scheduledDate: { type: 'string' },
        scheduledTime: { type: 'string' },
        reminderMinutesBefore: { type: 'integer', description: 'Enable a reminder this many minutes before the scheduled time.' },
        repeat: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Optional simple repeat frequency.' },
      },
      output: textOutput(),
      async execute(args) {
        const input: TaskInput = {
          title: args.title,
          ...(args.note === undefined ? {} : { note: args.note }),
          ...(args.list === undefined ? {} : { list: args.list }),
          ...(args.priority === undefined ? {} : { priority: args.priority }),
          ...(args.scheduledDate === undefined ? {} : { scheduledDate: args.scheduledDate }),
          ...(args.scheduledTime === undefined ? {} : { scheduledTime: args.scheduledTime }),
          ...(args.reminderMinutesBefore === undefined ? {} : { reminder: { enabled: true, minutesBefore: args.reminderMinutesBefore } }),
          ...(args.repeat === undefined ? {} : { repeat: { frequency: args.repeat, interval: 1 } }),
        }
        const result = service.apply(crypto.randomUUID(), service.state().revision, { kind: 'create', input })
        const task = result.tasks.at(-1)!
        return {
          text: [
            '任务已记录。',
            `- ID：${task.id}`,
            `- 标题：${task.title}`,
            `- 计划：${renderSchedule(task)}`,
            `- 提醒：${renderReminder(task)}`,
            '- 查看位置：任务计划',
            task.scheduledDate !== undefined && task.scheduledTime === undefined
              ? '请明确告诉用户尚未设置定时提醒，并询问具体提醒时间。'
              : '请向用户明确确认以上记录结果。',
          ].join('\n'),
        }
      },
    }),
    defineTool({
      name: 'task_planner_update',
      description: 'Modify one task by exact id or an unambiguous title. Same-name tasks are never guessed; query first and pass taskId.',
      parameters: {
        ...referenceParameters,
        newTitle: { type: 'string' },
        note: { type: 'string' },
        list: { type: 'string', enum: ['work', 'personal'] },
        priority: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
        scheduledDate: { type: 'string', description: 'YYYY-MM-DD; an empty string clears the date.' },
        scheduledTime: { type: 'string', description: 'HH:mm; an empty string clears the time.' },
      },
      output: textOutput(),
      async execute(args) {
        const task = reference(service, args)
        const patch: TaskPatch = {
          ...(args.newTitle === undefined ? {} : { title: args.newTitle }),
          ...(args.note === undefined ? {} : { note: args.note }),
          ...(args.list === undefined ? {} : { list: args.list }),
          ...(args.priority === undefined ? {} : { priority: args.priority }),
          ...(args.scheduledDate === undefined ? {} : { scheduledDate: args.scheduledDate === '' ? undefined : args.scheduledDate }),
          ...(args.scheduledTime === undefined ? {} : { scheduledTime: args.scheduledTime === '' ? undefined : args.scheduledTime }),
        }
        const result = service.apply(crypto.randomUUID(), service.state().revision, { kind: 'update', taskId: task.id, patch })
        const updated = result.tasks.find(item => item.id === task.id)!
        return { text: `Updated task ${updated.id}: ${updated.title}` }
      },
    }),
    defineTool({
      name: 'task_planner_complete',
      description: 'Complete or restore one task by exact id or unambiguous title. Same-name tasks are never guessed.',
      parameters: { ...referenceParameters, completed: { type: 'boolean', required: true, description: 'true completes; false restores.' } },
      output: textOutput(),
      async execute(args) {
        const task = reference(service, args)
        const result = service.apply(crypto.randomUUID(), service.state().revision, { kind: args.completed ? 'complete' : 'restore', taskId: task.id })
        const updated = result.tasks.find(item => item.id === task.id)!
        return { text: `${args.completed ? 'Completed' : 'Restored'} task ${updated.id}: ${updated.title}` }
      },
    }),
    defineTool({
      name: 'task_planner_delete',
      description: 'Delete one local task. This is destructive: confirm must be true after the user explicitly confirms. Never infer confirmation. Same-name tasks are rejected as ambiguous.',
      parameters: { ...referenceParameters, confirm: { type: 'boolean', required: true, description: 'Must be true only after explicit user confirmation.' } },
      output: textOutput(),
      async execute(args) {
        const task = reference(service, args)
        if (!args.confirm) return { text: `Confirmation required before deleting ${task.id}: ${task.title}` }
        service.apply(crypto.randomUUID(), service.state().revision, { kind: 'delete', taskId: task.id })
        return { text: `Deleted task ${task.id}: ${task.title}` }
      },
    }),
  ]
}
