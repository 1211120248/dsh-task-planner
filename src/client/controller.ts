export interface PlannerUiSnapshot {
  open: boolean
  count: number
}

export class PlannerUiController {
  private snapshot: PlannerUiSnapshot = { open: false, count: 0 }
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): PlannerUiSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  open = (): void => { this.update({ open: true }) }
  close = (): void => { this.update({ open: false }) }
  toggle = (): void => { this.update({ open: !this.snapshot.open }) }
  setCount = (count: number): void => { this.update({ count }) }

  private update(patch: Partial<PlannerUiSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (next.open === this.snapshot.open && next.count === this.snapshot.count) return
    this.snapshot = next
    for (const listener of [...this.listeners]) listener()
  }
}
