import type { PlannerAction, PlannerActionEnvelope, PlannerEvent, PlannerResponse } from '../protocol.ts'
import { API_PREFIX } from '../protocol.ts'

const TIMEOUT_MS = 15_000

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => { controller.abort() }, TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const value = await response.json() as T & { error?: string }
    if (!response.ok) throw new Error(value.error ?? `Host request failed (${response.status})`)
    return value
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Host request timed out')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export function readState(): Promise<PlannerResponse> {
  return request(`${API_PREFIX}/state`)
}

export function sendAction(action: PlannerAction, baseRevision?: number): Promise<PlannerResponse> {
  const envelope: PlannerActionEnvelope = { requestId: uuid(), ...(baseRevision === undefined ? {} : { baseRevision }), action }
  return request(`${API_PREFIX}/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  })
}

export function subscribeEvents(listener: (event?: PlannerEvent) => void): () => void {
  const source = new EventSource(`${API_PREFIX}/events`)
  source.onmessage = (message): void => {
    try {
      const event = JSON.parse(message.data as string) as PlannerEvent
      if (!Number.isSafeInteger(event.revision)) throw new Error('invalid event')
      listener(event)
    } catch { listener() }
  }
  source.onerror = (): void => { listener() }
  const onVisible = (): void => { if (document.visibilityState === 'visible') listener() }
  document.addEventListener('visibilitychange', onVisible)
  return () => { document.removeEventListener('visibilitychange', onVisible); source.close() }
}
