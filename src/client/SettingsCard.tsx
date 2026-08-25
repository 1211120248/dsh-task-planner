import { useState, useSyncExternalStore, type ChangeEvent } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { Config } from '../index.ts'
import { readState, sendAction } from './host-api.ts'
import { Icon } from './icons.tsx'
import type { TaskPlannerKey } from './locales.ts'
import css from './settings.module.css'

export interface SettingsCardProps {
  settingsScope: SettingsScope<Config>
  t: (key: TaskPlannerKey) => string
}

export function SettingsCard({ settingsScope, t }: SettingsCardProps) {
  const snapshot = useSyncExternalStore(
    listener => settingsScope.subscribe(listener),
    () => settingsScope.getSnapshot(),
  )
  const [saving, setSaving] = useState<string>()
  const [message, setMessage] = useState<string>()
  const value = snapshot.value ?? {}
  if (snapshot.status === 'loading') return <section className={css.card} aria-busy="true">{t('loading.title')}</section>
  if (snapshot.status === 'unavailable') return null

  const set = async (field: string, next: unknown): Promise<void> => {
    setSaving(field)
    setMessage(undefined)
    try {
      await settingsScope.set(field, next)
      setMessage(t('settings.saved'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setSaving(undefined) }
  }
  const toggle = (field: keyof Config, checked: boolean): void => { void set(field, checked) }

  const download = async (): Promise<void> => {
    const response = await fetch('/api/task-planner/backup', { cache: 'no-store' })
    if (!response.ok) throw new Error(`backup failed (${response.status})`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `dsh-task-planner-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const restore = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined || !window.confirm(t('settings.restoreConfirm'))) return
    try {
      const parsed = JSON.parse(await file.text()) as { tasks?: unknown }
      if (!Array.isArray(parsed.tasks)) throw new Error('tasks array missing')
      const state = await readState()
      await sendAction({ kind: 'import', mode: 'replace', tasks: parsed.tasks as never[] }, state.revision)
      setMessage(t('settings.restoreDone'))
    } catch {
      setMessage(t('settings.restoreError'))
    }
  }

  const requestPermission = async (): Promise<void> => {
    if (!('Notification' in window)) return setMessage(t('settings.boundary'))
    const permission = await Notification.requestPermission()
    setMessage(permission === 'granted' ? t('settings.saved') : t('settings.boundary'))
  }

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return (
    <section className={css.card} data-dsh-plugin="task-planner" data-dsh-part="settings">
      <div className={css.heading}>
        <span className={css.icon}><Icon name="check" /></span>
        <span><strong>{t('settings.title')}</strong><small>{t('settings.description')}</small></span>
      </div>
      <div className={css.fields}>
        <Toggle label={t('settings.enabled')} checked={value.enabled ?? true} busy={saving === 'enabled'} onChange={checked => { toggle('enabled', checked) }} />
        <Toggle label={t('settings.notifications')} checked={value.notificationsEnabled ?? true} busy={saving === 'notificationsEnabled'} onChange={checked => { toggle('notificationsEnabled', checked) }} />
        <button type="button" className={css.secondaryButton} onClick={() => { void requestPermission() }}><Icon name="bell" size={16} />{t('settings.notificationPermission')}</button>
        <label className={css.field}>
          <span>{t('settings.timeZone')}</span>
          <select value={value.timeZone ?? 'local'} disabled={!snapshot.writable || saving === 'timeZone'} onChange={event => { void set('timeZone', event.target.value) }}>
            <option value="local">{t('settings.localTimeZone')}</option>
            {browserZone !== 'local' ? <option value={browserZone}>{browserZone}</option> : null}
            <option value="UTC">UTC</option>
          </select>
        </label>
        <Toggle label={t('settings.agentTools')} checked={value.agentToolsEnabled ?? true} busy={saving === 'agentToolsEnabled'} onChange={checked => { toggle('agentToolsEnabled', checked) }} />
        <Toggle label={t('settings.announce')} checked={value.announceToAgent ?? false} busy={saving === 'announceToAgent'} onChange={checked => { toggle('announceToAgent', checked) }} />
        <div className={css.twoColumns}>
          <NumberField label={t('settings.missedHours')} value={value.missedReminderHours ?? 24} min={1} max={168} onChange={next => { void set('missedReminderHours', next) }} />
          <NumberField label={t('settings.snoozeMinutes')} value={value.snoozeMinutes ?? 10} min={1} max={1440} onChange={next => { void set('snoozeMinutes', next) }} />
        </div>
      </div>
      <div className={css.backup}>
        <strong>{t('settings.backup')}</strong>
        <div className={css.backupActions}>
          <button type="button" onClick={() => { void download().catch(error => { setMessage(String(error)) }) }}><Icon name="download" size={16} />{t('settings.download')}</button>
          <label className={css.fileButton}><Icon name="upload" size={16} />{t('settings.restore')}<input type="file" accept="application/json,.json" onChange={event => { void restore(event) }} /></label>
        </div>
      </div>
      <p className={css.boundary}>{t('settings.boundary')}</p>
      <p className={css.privacy}>{t('settings.privacy')}</p>
      {message !== undefined ? <p className={css.message} role="status">{message}</p> : null}
    </section>
  )
}

function Toggle({ label, checked, busy, onChange }: { label: string; checked: boolean; busy: boolean; onChange: (checked: boolean) => void }) {
  return <label className={css.toggle}><span>{label}</span><input type="checkbox" checked={checked} disabled={busy} onChange={event => { onChange(event.target.checked) }} /><span className={css.switch} /></label>
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className={css.field}><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={event => { onChange(Number(event.target.value)) }} /></label>
}
