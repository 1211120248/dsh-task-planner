import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { Config } from '../index.ts'
import { localDateKey, reminderDueAt, tasksForView } from '../core/dates.ts'
import type { ChecklistItem, PlannerView, ReminderClaim, Task, TaskInput, TaskPatch } from '../core/types.ts'
import type { PlannerAction, PlannerResponse } from '../protocol.ts'
import type { PlannerUiController } from './controller.ts'
import { readState, sendAction, subscribeEvents } from './host-api.ts'
import { Icon, type IconName } from './icons.tsx'
import { staticGroupLabelKey, viewHintKey, viewKey } from './labels.ts'
import type { TaskPlannerKey } from './locales.ts'
import css from './planner.module.css'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'
const ACTIVE_ATTR = 'data-dsh-taskplanner-active'
const TASK_BOARD_ACTIVE_ATTR = 'data-dsh-taskboard-active'
const SSH_ACTIVE_ATTR = 'data-dsh-ssh-active'
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'task-planner'
const SIDEBAR_CONTEXT_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'

/** Mount target inside the DSH center column; the Slot remains the lifecycle owner. */
function useConversationPanelHost(): HTMLDivElement | undefined {
  const [host, setHost] = useState<HTMLDivElement>()
  useEffect(() => {
    const element = document.createElement('div')
    element.dataset.dshTaskplannerView = ''
    element.dataset.dshPlugin = 'task-planner'
    element.dataset.dshPart = 'panel-host'
    element.className = css.panelHost
    const place = (): void => {
      const column = document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR)
      if (column === null) return
      if (element.parentElement !== column) column.appendChild(element)
      setHost(current => current ?? element)
    }
    const observer = new MutationObserver(place)
    observer.observe(document.body, { childList: true, subtree: true })
    place()
    return () => {
      observer.disconnect()
      element.remove()
    }
  }, [])
  return host
}

export interface TaskPlannerOverlayProps {
  planner: PlannerUiController
  settingsScope: SettingsScope<Config>
  t: (key: TaskPlannerKey) => string
}

interface ToastState {
  message: string
  token?: string
  expiresAt?: number
}

interface TaskDraft {
  title: string
  note: string
  checklist: ChecklistItem[]
  priority: Task['priority']
  list: Task['list']
  scheduledDate: string
  scheduledTime: string
  reminderMinutes: string
  repeat: '' | 'daily' | 'weekly' | 'monthly'
}

const VIEW_ICONS: Record<PlannerView, IconName> = {
  today: 'sun', inbox: 'inbox', upcoming: 'future', completed: 'archive', work: 'briefcase', personal: 'user',
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    note: task.note,
    checklist: task.checklist.map(item => ({ ...item })),
    priority: task.priority,
    list: task.list,
    scheduledDate: task.scheduledDate ?? '',
    scheduledTime: task.scheduledTime ?? '',
    reminderMinutes: task.reminder?.enabled ? String(task.reminder.minutesBefore) : '',
    repeat: task.repeat?.frequency ?? '',
  }
}

function dayAfter(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + 1)
  return localDateKey(value)
}

function formatDate(value: string, language: string): string {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', weekday: 'short' }).format(date)
}

function formatHeaderDate(language: string): string {
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
}

export function TaskPlannerOverlay({ planner, settingsScope, t }: TaskPlannerOverlayProps) {
  const ui = useSyncExternalStore(planner.subscribe, planner.getSnapshot)
  const panelHost = useConversationPanelHost()
  const settings = useSyncExternalStore(
    listener => settingsScope.subscribe(listener),
    () => settingsScope.getSnapshot(),
  )
  const [state, setState] = useState<PlannerResponse>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [view, setView] = useState<PlannerView>('today')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [navOpen, setNavOpen] = useState(false)
  const [toast, setToast] = useState<ToastState>()
  const [reminder, setReminder] = useState<ReminderClaim>()
  const [busy, setBusy] = useState(false)
  const revision = useRef<number>()
  const claiming = useRef(new Set<string>())
  const quickInput = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const language = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'

  useEffect(() => {
    const onPanelActivate = (event: Event): void => {
      if ((event as CustomEvent).detail !== PANEL_NAME && document.documentElement.hasAttribute(ACTIVE_ATTR)) planner.close()
    }
    const onSidebarContext = (event: MouseEvent): void => {
      if (!document.documentElement.hasAttribute(ACTIVE_ATTR)) return
      const target = event.target as HTMLElement | null
      if (target !== null && target.closest(SIDEBAR_CONTEXT_SELECTOR) !== null) planner.close()
    }
    document.addEventListener(ACTIVATE_EVENT, onPanelActivate)
    document.addEventListener('click', onSidebarContext, true)
    return () => {
      document.removeEventListener(ACTIVATE_EVENT, onPanelActivate)
      document.removeEventListener('click', onSidebarContext, true)
    }
  }, [planner])

  useEffect(() => {
    const root = document.documentElement
    if (!ui.open) {
      root.removeAttribute(ACTIVE_ATTR)
      return
    }
    // Existing Task Board and SSH releases only recognize one another's
    // activation names. Emit both legacy names before claiming the center
    // column so their controllers settle closed instead of requiring a
    // second click the next time either row is opened.
    root.removeAttribute(TASK_BOARD_ACTIVE_ATTR)
    root.removeAttribute(SSH_ACTIVE_ATTR)
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'ssh' }))
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'taskboard' }))
    root.setAttribute(ACTIVE_ATTR, '')
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
    return () => { root.removeAttribute(ACTIVE_ATTR) }
  }, [ui.open])

  const acceptState = useCallback((next: PlannerResponse): void => {
    revision.current = next.revision
    setState(next)
    setError(undefined)
    setLoading(false)
  }, [])

  const load = useCallback(async (): Promise<void> => {
    try { acceptState(await readState()) } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setLoading(false)
    }
  }, [acceptState])

  useEffect(() => { void load() }, [load])
  useEffect(() => subscribeEvents(event => {
    if (event === undefined || event.revision !== revision.current) void load()
  }), [load])

  const openTasks = state?.tasks.filter(task => task.status === 'open') ?? []
  useEffect(() => { planner.setCount(openTasks.length) }, [openTasks.length, planner])

  const currentSettings = settings.value ?? {}
  const notificationsEnabled = currentSettings.notificationsEnabled ?? true
  const timeZone = currentSettings.timeZone?.trim() || 'local'
  const snoozeMinutes = Math.max(1, Math.trunc(currentSettings.snoozeMinutes ?? 10))

  const claimDueReminders = useCallback(async (): Promise<void> => {
    if (!notificationsEnabled || state === undefined) return
    const now = Date.now()
    const due = state.tasks
      .map(task => ({ task, dueAt: reminderDueAt(task, timeZone) }))
      .filter((entry): entry is { task: Task; dueAt: number } => entry.dueAt !== undefined && entry.dueAt <= now && (entry.task.reminder?.lastNotifiedAt ?? 0) < entry.dueAt)
      .sort((a, b) => a.dueAt - b.dueAt)
    for (const entry of due.slice(0, 3)) {
      if (claiming.current.has(entry.task.id)) continue
      claiming.current.add(entry.task.id)
      try {
        const response = await sendAction({ kind: 'claim-reminder', taskId: entry.task.id, now }, revision.current)
        acceptState(response)
        if (response.reminderClaim !== undefined) {
          setReminder(response.reminderClaim)
          if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(response.reminderClaim.missed ? t('reminder.missed') : t('reminder.title'), { body: response.reminderClaim.title, tag: `dsh-task-planner-${entry.task.id}` })
            notification.onclick = (): void => { planner.open(); window.focus(); notification.close() }
          }
        }
      } catch { /* The next interval retries after the Host reconnects. */ }
      finally { claiming.current.delete(entry.task.id) }
    }
  }, [acceptState, notificationsEnabled, planner, state, t, timeZone])

  useEffect(() => {
    void claimDueReminders()
    const timer = window.setInterval(() => { void claimDueReminders() }, 30_000)
    return () => { window.clearInterval(timer) }
  }, [claimDueReminders])

  useEffect(() => {
    if (!ui.open) return
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]') === true
      if (event.key === 'Escape') { planner.close(); return }
      if (!editing && event.key.toLocaleLowerCase() === 'n') { event.preventDefault(); quickInput.current?.focus() }
      if (!editing && event.key === '/') { event.preventDefault(); searchInput.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [planner, ui.open])

  useEffect(() => {
    if (toast === undefined) return
    const timer = window.setTimeout(() => { setToast(undefined) }, Math.max(500, (toast.expiresAt ?? Date.now() + 3_000) - Date.now()))
    return () => { window.clearTimeout(timer) }
  }, [toast])

  const mutate = useCallback(async (action: PlannerAction, message: string): Promise<PlannerResponse | undefined> => {
    setBusy(true)
    try {
      const response = await sendAction(action, revision.current)
      acceptState(response)
      setToast({ message, token: response.undoToken, expiresAt: response.undoExpiresAt })
      return response
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : String(mutationError))
      void load()
      return undefined
    } finally { setBusy(false) }
  }, [acceptState, load])

  const undo = async (): Promise<void> => {
    if (toast?.token === undefined) return
    await mutate({ kind: 'undo', token: toast.token }, t('toast.undone'))
  }

  const snooze = async (): Promise<void> => {
    if (reminder === undefined) return
    await mutate({ kind: 'snooze', taskId: reminder.taskId, until: Date.now() + snoozeMinutes * 60_000 }, t('reminder.snooze'))
    setReminder(undefined)
  }

  if (!ui.open) {
    return reminder === undefined ? null : <ReminderCard claim={reminder} t={t} onOpen={() => { planner.open(); setSelectedId(reminder.taskId) }} onSnooze={() => { void snooze() }} onClose={() => { setReminder(undefined) }} />
  }

  const today = localDateKey()
  const tasks = state === undefined ? [] : tasksForView(state.tasks, view, today, search)
  const selected = state?.tasks.find(task => task.id === selectedId)
  const selectView = (next: PlannerView): void => {
    setView(next)
    setSearch('')
    setSelectedId(undefined)
    setNavOpen(false)
  }
  const counts = {
    today: state?.tasks.filter(task => task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate <= today).length ?? 0,
    inbox: state?.tasks.filter(task => task.status === 'open' && task.scheduledDate === undefined).length ?? 0,
    upcoming: state?.tasks.filter(task => task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate > today).length ?? 0,
    completed: state?.tasks.filter(task => task.status === 'completed').length ?? 0,
    work: state?.tasks.filter(task => task.status === 'open' && task.list === 'work').length ?? 0,
    personal: state?.tasks.filter(task => task.status === 'open' && task.list === 'personal').length ?? 0,
  }
  const overdue = state?.tasks.filter(task => task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate < today).length ?? 0
  const doneToday = state?.tasks.filter(task => task.status === 'completed' && task.completedAt !== undefined && localDateKey(new Date(task.completedAt)) === today).length ?? 0

  const quickCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const title = String(form.get('title') ?? '').trim()
    if (title === '') return
    const destinationView: PlannerView = view === 'completed' ? 'inbox' : view
    const input: TaskInput = {
      title,
      list: destinationView === 'personal' ? 'personal' : 'work',
      ...(destinationView === 'today' ? { scheduledDate: today } : destinationView === 'upcoming' ? { scheduledDate: dayAfter(today) } : {}),
    }
    const response = await mutate({ kind: 'create', input }, t('toast.created'))
    const created = response?.tasks.find(task => task.title === title && task.createdAt === Math.max(...response.tasks.map(item => item.createdAt)))
    if (created !== undefined) {
      if (view === 'completed') { setView('inbox'); setSearch('') }
      setSelectedId(created.id)
    }
    formElement.reset()
  }

  const toggleTask = async (task: Task): Promise<void> => {
    await mutate({ kind: task.status === 'completed' ? 'restore' : 'complete', taskId: task.id }, t(task.status === 'completed' ? 'toast.restored' : 'toast.completed'))
  }

  if (panelHost === undefined) return null

  return createPortal(
    <div className={css.panel} data-dsh-plugin="task-planner" data-dsh-part="panel" role="region" aria-label={t('entry.label')}>
      <div className={css.shell}>
        <aside className={`${css.navigation} ${navOpen ? css.navigationOpen : ''}`} data-dsh-part="navigation" aria-label={t('app.menu')}>
          <div className={css.brand}><span className={css.brandMark}><Icon name="check" /></span><span><strong>{t('entry.label')}</strong><small>DSH</small></span></div>
          <nav className={css.views}>
            {(['today', 'inbox', 'upcoming', 'completed'] as PlannerView[]).map(item => <ViewButton key={item} view={item} active={view === item} count={counts[item]} t={t} onClick={() => { selectView(item) }} />)}
            <div className={css.navDivider} />
            {(['work', 'personal'] as PlannerView[]).map(item => <ViewButton key={item} view={item} active={view === item} count={counts[item]} t={t} onClick={() => { selectView(item) }} />)}
          </nav>
          <div className={css.shortcutHint}><kbd>N</kbd><span>{t('app.newTask')}</span><kbd>/</kbd><span>{t('app.search')}</span></div>
          <p className={css.runtimeBoundary}><Icon name="bell" size={15} />{t('reminder.boundary')}</p>
        </aside>

        {navOpen ? <button type="button" className={css.navMask} aria-label={t('app.close')} onClick={() => { setNavOpen(false) }} /> : null}

        <main className={css.workspace} data-dsh-part="workspace">
          <header className={css.header} data-dsh-part="header">
            <button type="button" className={css.mobileMenu} aria-label={t('app.menu')} onClick={() => { setNavOpen(true) }}><Icon name="menu" /></button>
            <div className={css.titleBlock}><span>{view === 'today' ? formatHeaderDate(language) : t(viewHintKey(view))}</span><h1>{t(viewKey(view))}</h1></div>
            <label className={css.search}><Icon name="search" size={16} /><input ref={searchInput} value={search} aria-label={t('app.search')} placeholder={t('app.searchPlaceholder')} onChange={event => { setSearch(event.target.value) }} /></label>
            <button type="button" className={css.closeButton} aria-label={t('app.close')} onClick={planner.close}><Icon name="close" /></button>
          </header>

          <div className={css.content}>
            {view === 'today' ? <section className={css.summary} data-dsh-part="summary">
              <SummaryCard label={t('summary.openToday')} value={counts.today} icon="sun" />
              <SummaryCard label={t('summary.overdue')} value={overdue} icon="clock" tone="danger" />
              <SummaryCard label={t('summary.doneToday')} value={doneToday} icon="check" tone="success" />
            </section> : null}
            <form className={css.quickAdd} data-dsh-part="quick-add" aria-busy={busy} onSubmit={event => { void quickCreate(event) }}>
              <span><Icon name="plus" /></span><input ref={quickInput} name="title" autoComplete="off" placeholder={t(view === 'completed' ? 'app.quickCompletedPlaceholder' : 'app.quickPlaceholder')} aria-label={t('app.newTask')} disabled={busy || loading} />
              <button type="submit" aria-label={t('app.newTask')} disabled={busy || loading}><Icon name="chevron" size={17} /></button>
            </form>
            <section className={css.taskSurface} data-dsh-part="task-list" aria-busy={loading}>
              {loading ? <StatusState icon="clock" title={t('loading.title')} />
                : error !== undefined && state === undefined ? <StatusState icon="archive" title={t('error.title')} action={t('error.retry')} onAction={() => { setLoading(true); void load() }} />
                  : tasks.length === 0 ? <StatusState icon="check" title={t(search ? 'empty.searchTitle' : 'empty.title')} hint={t(search ? 'empty.searchHint' : 'empty.hint')} />
                    : <TaskGroups tasks={tasks} view={view} today={today} language={language} selectedId={selectedId} t={t} onSelect={setSelectedId} onToggle={task => { void toggleTask(task) }} />}
            </section>
          </div>
        </main>

        <aside className={`${css.inspector} ${selected !== undefined ? css.inspectorOpen : ''}`} data-dsh-part="inspector" aria-label={t('detail.title')}>
          {selected === undefined
            ? <div className={css.detailEmpty}><Icon name="sparkle" size={25} /><p>{t('detail.placeholder')}</p></div>
            : <TaskEditor key={`${selected.id}-${selected.updatedAt}`} task={selected} busy={busy} t={t} onClose={() => { setSelectedId(undefined) }} onSave={async patch => {
                const rescheduled = patch.scheduledDate !== selected.scheduledDate || patch.scheduledTime !== selected.scheduledTime
                await mutate({ kind: 'update', taskId: selected.id, patch }, t(rescheduled ? 'toast.rescheduled' : 'toast.saved'))
              }} onDelete={async () => {
                if (!window.confirm(t('detail.deleteConfirm'))) return
                const result = await mutate({ kind: 'delete', taskId: selected.id }, t('toast.deleted'))
                if (result !== undefined) setSelectedId(undefined)
              }} />}
        </aside>
      </div>
      {toast !== undefined ? <div className={css.toast} data-dsh-part="toast" role="status" aria-live="polite"><Icon name="check" size={16} /><span>{toast.message}</span>{toast.token !== undefined ? <button type="button" onClick={() => { void undo() }}><Icon name="undo" size={15} />{t('toast.undo')}</button> : null}</div> : null}
      {reminder !== undefined ? <ReminderCard claim={reminder} t={t} onOpen={() => { setSelectedId(reminder.taskId); setReminder(undefined) }} onSnooze={() => { void snooze() }} onClose={() => { setReminder(undefined) }} /> : null}
    </div>,
    panelHost,
  )
}

function ViewButton({ view, active, count, t, onClick }: { view: PlannerView; active: boolean; count: number; t: (key: TaskPlannerKey) => string; onClick: () => void }) {
  return <button type="button" className={active ? css.viewActive : css.viewButton} aria-current={active ? 'page' : undefined} onClick={onClick}><Icon name={VIEW_ICONS[view]} size={17} /><span>{t(viewKey(view))}</span><small>{count}</small></button>
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone?: 'danger' | 'success' }) {
  return <div className={css.summaryCard} data-tone={tone}><span><Icon name={icon} size={17} /></span><strong>{value}</strong><small>{label}</small></div>
}

function StatusState({ icon, title, hint, action, onAction }: { icon: IconName; title: string; hint?: string; action?: string; onAction?: () => void }) {
  return <div className={css.statusState}><span><Icon name={icon} size={24} /></span><strong>{title}</strong>{hint ? <p>{hint}</p> : null}{action ? <button type="button" onClick={onAction}>{action}</button> : null}</div>
}

function TaskGroups({ tasks, view, today, language, selectedId, t, onSelect, onToggle }: { tasks: Task[]; view: PlannerView; today: string; language: string; selectedId?: string; t: (key: TaskPlannerKey) => string; onSelect: (id: string) => void; onToggle: (task: Task) => void }) {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = view === 'today' ? task.scheduledDate! < today ? 'overdue' : 'today'
      : view === 'upcoming' ? task.scheduledDate ?? 'inbox'
        : view === 'completed' ? 'completed'
          : view === 'inbox' ? 'inbox' : view
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return <>{[...groups].map(([key, items]) => {
    const labelKey = staticGroupLabelKey(key)
    const label = key.match(/^\d{4}-/) ? formatDate(key, language) : labelKey === undefined ? key : t(labelKey)
    return <section className={css.taskGroup} key={key}><h2 data-tone={key === 'overdue' ? 'danger' : undefined}><span />{label}<small>{items.length}</small></h2><div className={css.taskList} role="list">{items.map(task => <TaskRow key={task.id} task={task} selected={selectedId === task.id} today={today} language={language} t={t} onSelect={() => { onSelect(task.id) }} onToggle={() => { onToggle(task) }} />)}</div></section>
  })}</>
}

function TaskRow({ task, selected, today, language, t, onSelect, onToggle }: { task: Task; selected: boolean; today: string; language: string; t: (key: TaskPlannerKey) => string; onSelect: () => void; onToggle: () => void }) {
  const overdue = task.status === 'open' && task.scheduledDate !== undefined && task.scheduledDate < today
  const checklistDone = task.checklist.filter(item => item.completed).length
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter') onSelect()
    if (event.key === ' ') { event.preventDefault(); onToggle() }
  }
  return <article className={`${css.taskRow} ${selected ? css.taskSelected : ''} ${task.status === 'completed' ? css.taskCompleted : ''}`} data-dsh-part="task-row" role="listitem" tabIndex={0} aria-current={selected ? 'true' : undefined} onClick={onSelect} onKeyDown={onKeyDown}>
    <button type="button" className={css.checkButton} data-checked={task.status === 'completed' ? 'true' : undefined} aria-label={t(task.status === 'completed' ? 'task.restore' : 'task.complete')} onClick={event => { event.stopPropagation(); onToggle() }}>{task.status === 'completed' ? <Icon name="check" size={14} /> : null}</button>
    <div className={css.taskMain}><strong>{task.title}</strong><div className={css.taskMeta}>
      {task.scheduledDate !== undefined ? <span data-tone={overdue ? 'danger' : undefined}><Icon name={task.scheduledTime ? 'clock' : 'calendar'} size={12} />{formatDate(task.scheduledDate, language)}{task.scheduledTime ? ` ${task.scheduledTime}` : ''}</span> : <span><Icon name="inbox" size={12} />{t('section.inbox')}</span>}
      <span>{t(viewKey(task.list))}</span>
      {task.checklist.length > 0 ? <span><Icon name="check" size={12} />{checklistDone}/{task.checklist.length}</span> : null}
      {task.repeat !== undefined ? <span><Icon name="repeat" size={12} />{t(`task.repeat.${task.repeat.frequency}` as TaskPlannerKey)}</span> : null}
      {task.priority !== 'none' ? <span data-priority={task.priority}>{t(`task.${task.priority}` as TaskPlannerKey)}</span> : null}
    </div></div>
    <Icon name="chevron" size={16} />
  </article>
}

function TaskEditor({ task, busy, t, onClose, onSave, onDelete }: { task: Task; busy: boolean; t: (key: TaskPlannerKey) => string; onClose: () => void; onSave: (patch: TaskPatch) => Promise<void>; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task))
  const patch = (value: Partial<TaskDraft>): void => { setDraft(current => ({ ...current, ...value })) }
  const addChecklist = (): void => { patch({ checklist: [...draft.checklist, { id: crypto.randomUUID(), text: '', completed: false }] }) }
  const updateChecklist = (id: string, value: Partial<ChecklistItem>): void => { patch({ checklist: draft.checklist.map(item => item.id === id ? { ...item, ...value } : item) }) }
  const removeChecklist = (id: string): void => { patch({ checklist: draft.checklist.filter(item => item.id !== id) }) }
  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const title = draft.title.trim()
    if (title === '') return
    await onSave({
      title,
      note: draft.note.trim(),
      checklist: draft.checklist.filter(item => item.text.trim() !== '').map(item => ({ ...item, text: item.text.trim() })),
      priority: draft.priority,
      list: draft.list,
      scheduledDate: draft.scheduledDate || undefined,
      scheduledTime: draft.scheduledDate && draft.scheduledTime ? draft.scheduledTime : undefined,
      reminder: draft.scheduledDate && draft.scheduledTime && draft.reminderMinutes !== '' ? { enabled: true, minutesBefore: Number(draft.reminderMinutes) } : { enabled: false, minutesBefore: 0 },
      repeat: draft.repeat === '' ? undefined : { frequency: draft.repeat, interval: 1 },
    })
  }
  return <form className={css.editor} onSubmit={event => { void save(event) }}>
    <div className={css.editorHeader}><div><small>{t('detail.title')}</small><strong>{task.id.slice(0, 8)}</strong></div><button type="button" aria-label={t('app.close')} onClick={onClose}><Icon name="close" size={18} /></button></div>
    <label className={css.field}><span>{t('detail.titleLabel')}</span><input value={draft.title} onChange={event => { patch({ title: event.target.value }) }} /></label>
    <label className={css.field}><span>{t('detail.note')}</span><textarea value={draft.note} placeholder={t('detail.notePlaceholder')} onChange={event => { patch({ note: event.target.value }) }} /></label>
    <div className={css.field}><span>{t('detail.checklist')}</span><div className={css.checklist}>
      {draft.checklist.map(item => <div key={item.id} className={css.checklistRow}><input type="checkbox" checked={item.completed} aria-label={item.text || t('detail.checklist')} onChange={event => { updateChecklist(item.id, { completed: event.target.checked }) }} /><input value={item.text} onChange={event => { updateChecklist(item.id, { text: event.target.value }) }} /><button type="button" aria-label={t('detail.removeChecklist')} onClick={() => { removeChecklist(item.id) }}><Icon name="close" size={14} /></button></div>)}
      <button type="button" className={css.addChecklist} onClick={addChecklist}><Icon name="plus" size={15} />{t('detail.addChecklist')}</button>
    </div></div>
    <div className={css.twoFields}>
      <label className={css.field}><span>{t('detail.list')}</span><select value={draft.list} onChange={event => { patch({ list: event.target.value as Task['list'] }) }}><option value="work">{t('view.work')}</option><option value="personal">{t('view.personal')}</option></select></label>
      <label className={css.field}><span>{t('detail.priority')}</span><select value={draft.priority} onChange={event => { patch({ priority: event.target.value as Task['priority'] }) }}><option value="none">{t('detail.priority.none')}</option><option value="low">{t('detail.priority.low')}</option><option value="medium">{t('detail.priority.medium')}</option><option value="high">{t('detail.priority.high')}</option></select></label>
      <label className={css.field}><span>{t('detail.date')}</span><input type="date" value={draft.scheduledDate} onChange={event => { patch({ scheduledDate: event.target.value, ...(event.target.value === '' ? { scheduledTime: '', reminderMinutes: '' } : {}) }) }} /></label>
      <label className={css.field}><span>{t('detail.time')}</span><input type="time" value={draft.scheduledTime} disabled={!draft.scheduledDate} onChange={event => { patch({ scheduledTime: event.target.value }) }} /></label>
      <label className={css.field}><span>{t('detail.reminder')}</span><select value={draft.reminderMinutes} disabled={!draft.scheduledDate || !draft.scheduledTime} onChange={event => { patch({ reminderMinutes: event.target.value }) }}><option value="">{t('detail.reminder.none')}</option><option value="0">{t('detail.reminder.atTime')}</option><option value="10">{t('detail.reminder.10m')}</option><option value="30">{t('detail.reminder.30m')}</option><option value="60">{t('detail.reminder.1h')}</option></select></label>
      <label className={css.field}><span>{t('detail.repeat')}</span><select value={draft.repeat} onChange={event => { patch({ repeat: event.target.value as TaskDraft['repeat'] }) }}><option value="">{t('detail.repeat.none')}</option><option value="daily">{t('task.repeat.daily')}</option><option value="weekly">{t('task.repeat.weekly')}</option><option value="monthly">{t('task.repeat.monthly')}</option></select></label>
    </div>
    <div className={css.editorActions}><button type="submit" disabled={busy || draft.title.trim() === ''}>{t('detail.save')}</button><button type="button" disabled={busy} aria-label={t('detail.delete')} onClick={() => { void onDelete() }}><Icon name="trash" size={17} /></button></div>
  </form>
}

function ReminderCard({ claim, t, onOpen, onSnooze, onClose }: { claim: ReminderClaim; t: (key: TaskPlannerKey) => string; onOpen: () => void; onSnooze: () => void; onClose: () => void }) {
  return <aside className={css.reminderCard} data-dsh-plugin="task-planner" data-dsh-part="reminder" role="alert"><span className={css.reminderIcon}><Icon name="bell" /></span><div><small>{t(claim.missed ? 'reminder.missed' : 'reminder.title')}</small><strong>{claim.title}</strong><div><button type="button" onClick={onOpen}>{t('reminder.open')}</button><button type="button" onClick={onSnooze}>{t('reminder.snooze')}</button></div></div><button type="button" aria-label={t('reminder.dismiss')} onClick={onClose}><Icon name="close" size={16} /></button></aside>
}
