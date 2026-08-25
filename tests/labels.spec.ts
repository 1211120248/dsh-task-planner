import { describe, expect, it } from 'vitest'
import { staticGroupLabelKey, viewHintKey, viewKey } from '../src/client/labels.ts'
import { en, zh } from '../src/client/locales.ts'

describe('client labels', () => {
  it('maps every task view and static group to a translated key', () => {
    const views = ['today', 'inbox', 'upcoming', 'completed', 'work', 'personal'] as const
    for (const view of views) {
      expect(zh[viewKey(view)]).not.toMatch(/^[a-z]+\./)
      expect(en[viewKey(view)]).not.toMatch(/^[a-z]+\./)
      expect(zh[viewHintKey(view)]).not.toMatch(/^[a-z]+\./)
      expect(en[viewHintKey(view)]).not.toMatch(/^[a-z]+\./)
    }

    for (const group of ['overdue', 'today', 'inbox', 'completed', 'work', 'personal']) {
      const key = staticGroupLabelKey(group)
      expect(key).toBeDefined()
      expect(zh[key!]).not.toMatch(/^[a-z]+\./)
      expect(en[key!]).not.toMatch(/^[a-z]+\./)
    }
  })

  it('does not invent a translation key for date groups', () => {
    expect(staticGroupLabelKey('2026-08-25')).toBeUndefined()
  })

  it('explains where tasks created from the completed view will go', () => {
    expect(zh['app.quickCompletedPlaceholder']).toContain('收件箱')
    expect(en['app.quickCompletedPlaceholder']).toContain('Inbox')
  })
})
