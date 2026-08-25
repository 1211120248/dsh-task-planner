import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { API_PREFIX, parseEnvelope } from '../protocol.ts'
import type { TaskPlannerService } from './service.ts'
import { trustedBrowserRequest } from './loopback.ts'

const ACTION_LIMIT = 2 * 1024 * 1024

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const value of request) {
    const chunk = value as Buffer
    size += chunk.length
    if (size > ACTION_LIMIT) throw new Error('body too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function taskPlannerRoutes(service: TaskPlannerService): WebRoute[] {
  const guard = (request: IncomingMessage, response: ServerResponse): boolean => {
    if (trustedBrowserRequest(request)) return true
    json(response, 403, { ok: false, error: 'forbidden' })
    return false
  }
  return [
    {
      kind: 'exact',
      path: `${API_PREFIX}/state`,
      handler(request, response): void {
        if (request.method !== 'GET') return json(response, 405, { ok: false, error: 'method not allowed' })
        if (!guard(request, response)) return
        json(response, 200, service.state())
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/action`,
      async handler(request, response): Promise<void> {
        if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'method not allowed' })
        if (!guard(request, response)) return
        if (!(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return json(response, 415, { ok: false, error: 'JSON required' })
        try {
          const envelope = parseEnvelope(await body(request))
          if (envelope === undefined) return json(response, 400, { ok: false, error: 'invalid action' })
          json(response, 200, service.apply(envelope.requestId, envelope.baseRevision, envelope.action))
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          json(response, message.startsWith('revision conflict') ? 409 : message === 'body too large' ? 413 : 400, { ok: false, error: message })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/events`,
      handler(request, response): void {
        if (request.method !== 'GET') {
          response.writeHead(405)
          response.end()
          return
        }
        if (!guard(request, response)) return
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        const push = (): void => {
          const state = service.state()
          response.write(`data: ${JSON.stringify({ revision: state.revision, updatedAt: state.updatedAt })}\n\n`)
        }
        const unsubscribe = service.ledger.subscribe(push)
        const heartbeat = setInterval(() => { response.write(': ping\n\n') }, 15_000)
        const close = (): void => { clearInterval(heartbeat); unsubscribe() }
        request.once('close', close)
        response.once('close', close)
        push()
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/backup`,
      handler(request, response): void {
        if (request.method !== 'GET') return json(response, 405, { ok: false, error: 'method not allowed' })
        if (!guard(request, response)) return
        const payload = `${JSON.stringify(service.state(), null, 2)}\n`
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="dsh-task-planner-${new Date().toISOString().slice(0, 10)}.json"`,
          'cache-control': 'no-store',
        })
        response.end(payload)
      },
    },
  ]
}
