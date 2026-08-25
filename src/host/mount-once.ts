const MOUNTED = Symbol.for('dsh-task-planner.mounted')

function mounted(): Set<string> {
  const root = globalThis as typeof globalThis & { [MOUNTED]?: Set<string> }
  return (root[MOUNTED] ??= new Set())
}

export function mountOnce<T extends (...args: any[]) => unknown>(id: string, apply: T): T {
  return ((...args: unknown[]) => {
    const registry = mounted()
    if (registry.has(id)) return
    registry.add(id)
    const ctx = args[0] as { effect?: (callback: () => unknown) => unknown }
    ctx?.effect?.(() => () => { registry.delete(id) })
    return apply(...args)
  }) as T
}
