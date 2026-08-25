import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('plugin contracts', () => {
  it('uses official Client Slots and stable semantic attributes', () => {
    const index = readFileSync('src/client/index.ts', 'utf8')
    const app = readFileSync('src/client/TaskPlanner.tsx', 'utf8')
    const entry = readFileSync('src/client/SidebarEntry.tsx', 'utf8')
    expect(index).toContain("ctx.slots.inject('sidebar.footer.action'")
    expect(index).toContain("ctx.slots.inject('shell.overlay'")
    expect(index).toContain("ctx.slots.inject('settings.plugins.tab'")
    expect(entry).toContain('createPortal')
    expect(entry).toContain('[data-dsh-taskboard-entry]')
    expect(entry).toContain('data-dsh-taskplanner-entry')
    expect(app).toContain('data-dsh-taskplanner-active')
    expect(app).toContain('data-dsh-part="panel"')
    expect(app).not.toContain('aria-modal="true"')
    expect(app).toContain('role="list"')
    expect(app).toContain('role="listitem"')
    expect(app).not.toContain('aria-selected={selected}')
    expect(app).toContain('data-dsh-plugin="task-planner"')
    expect(app).toContain('data-dsh-part="task-row"')
  })

  it('keeps component CSS free of fixed hex, rgb, and hsl colors', () => {
    const css = ['src/client/planner.module.css', 'src/client/settings.module.css'].map(file => readFileSync(file, 'utf8')).join('\n')
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\s*\(/i)
    expect(css).toContain('var(--dsw-')
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container task-planner')
    expect(css).toContain('.panel .search input:focus-visible, .panel .quickAdd input:focus-visible { outline: none; }')
    expect(css).toContain('.quickAdd:has(input:focus)')
  })

  it('documents the runtime-only reminder boundary in both locales', () => {
    const locales = readFileSync('src/client/locales.ts', 'utf8')
    expect(locales).toContain('关闭 DSH、系统休眠或浏览器冻结时不保证准时通知')
    expect(locales).toContain('not guaranteed while DSH is closed, the system sleeps, or the browser is suspended')
  })
})
