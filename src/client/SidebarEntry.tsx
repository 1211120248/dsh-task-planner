import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { TaskPlannerKey } from './locales.ts'
import type { PlannerUiController } from './controller.ts'
import { Icon } from './icons.tsx'
import css from './planner.module.css'

const SIDEBAR_COLUMN_SELECTOR = '[data-pane="sidebar"], [class*="sidebarCol"]'
const PRIMARY_ENTRY_SELECTOR = ':scope > [data-dsh-taskboard-entry], :scope > [data-dsh-ssh-entry], :scope > [data-dsh-skill-explorer-entry]'

/** Find the sidebar UI root that owns New Session and the primary navigation rows. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>(SIDEBAR_COLUMN_SELECTOR)
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** Place the portal host before Task Board, or before the first sibling primary row. */
function placeEntryHost(host: HTMLDivElement): boolean {
  const root = sidebarRoot()
  if (root === undefined) return false
  const taskBoard = root.querySelector<HTMLElement>(':scope > [data-dsh-taskboard-entry]')
  const firstPrimary = root.querySelector<HTMLElement>(PRIMARY_ENTRY_SELECTOR)
  const newSession = root.querySelector<HTMLElement>('button[class*="newSession"]')
  const anchor = taskBoard ?? firstPrimary ?? newSession?.nextElementSibling ?? null
  if (anchor === host || (host.parentElement === root && host.nextElementSibling === anchor)) return true
  root.insertBefore(host, anchor)
  return true
}

/** Create a self-healing portal host inside the DSH primary sidebar navigation. */
function useSidebarEntryHost(): HTMLDivElement | undefined {
  const [host, setHost] = useState<HTMLDivElement>()
  useEffect(() => {
    const element = document.createElement('div')
    element.dataset.dshTaskplannerEntryHost = ''
    element.className = css.sidebarEntryHost
    const place = (): void => {
      if (placeEntryHost(element)) setHost(current => current ?? element)
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

export interface SidebarEntryProps {
  wide: boolean
  planner: PlannerUiController
  t: (key: TaskPlannerKey) => string
}

/** Primary navigation entry rendered above the existing Task Board row. */
export function SidebarEntry({ wide, planner, t }: SidebarEntryProps) {
  const snapshot = useSyncExternalStore(planner.subscribe, planner.getSnapshot)
  const host = useSidebarEntryHost()
  if (host === undefined) return null
  return createPortal(
    <button
      type="button"
      className={css.sidebarEntry}
      data-dsh-plugin="task-planner"
      data-dsh-part="trigger"
      data-dsh-taskplanner-entry=""
      data-wide={wide ? 'wide' : 'rail'}
      aria-label={t('entry.label')}
      aria-current={snapshot.open ? 'page' : undefined}
      aria-expanded={snapshot.open}
      title={t('entry.label')}
      onClick={planner.toggle}
    >
      <span className={css.sidebarEntryIcon}><Icon name="check" size={wide ? 15 : 18} /></span>
      {wide ? <span className={css.sidebarEntryLabel}>{t('entry.label')}</span> : null}
      {snapshot.count > 0 ? <span className={css.sidebarCount}>{snapshot.count > 99 ? '99+' : snapshot.count}</span> : null}
    </button>,
    host,
  )
}
