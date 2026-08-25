import { describe, expect, it } from 'vitest'
import { parseEnvelope } from '../src/protocol.ts'

describe('planner action protocol', () => {
  it('accepts only known discriminated actions with their required fields', () => {
    expect(parseEnvelope({ requestId: 'request-create', action: { kind: 'create', input: { title: 'Ship' } } })?.action.kind).toBe('create')
    expect(parseEnvelope({ requestId: 'request-update', action: { kind: 'update', taskId: 'one', patch: { title: 'Ship now' } } })?.action.kind).toBe('update')
    expect(parseEnvelope({ requestId: 'request-import', action: { kind: 'import', mode: 'replace', tasks: [] } })?.action.kind).toBe('import')
  })

  it('rejects unknown, incomplete, and non-finite mutation payloads', () => {
    expect(parseEnvelope({ requestId: 'request-unknown', action: { kind: 'run-command', command: 'rm' } })).toBeUndefined()
    expect(parseEnvelope({ requestId: 'request-update', action: { kind: 'update', patch: {} } })).toBeUndefined()
    expect(parseEnvelope({ requestId: 'request-snooze', action: { kind: 'snooze', taskId: 'one', until: Number.POSITIVE_INFINITY } })).toBeUndefined()
  })
})
