export class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private starts: number[] = [];
  private timer: NodeJS.Timeout | null = null;
  constructor(private maxConcurrent = 8, private maxPerWindow = 50, private windowMs = 60_000) {}

  windowCount(): number {
    const now = Date.now();
    this.starts = this.starts.filter((t) => now - t < this.windowMs);
    return this.starts.length;
  }
  get waiting(): number { return this.queue.length; }
  private canStart(): boolean { return this.active < this.maxConcurrent && this.windowCount() < this.maxPerWindow; }
  private pump = (): void => {
    while (this.queue.length && this.canStart()) {
      this.active++; this.starts.push(Date.now()); this.queue.shift()!();
    }
    if (this.queue.length && !this.timer && this.active < this.maxConcurrent && this.starts.length) {
      const wait = Math.max(50, this.windowMs - (Date.now() - this.starts[0]));
      this.timer = setTimeout(() => { this.timer = null; this.pump(); }, wait);
    }
  };
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => { this.queue.push(resolve); this.pump(); });
    try { return await fn(); } finally { this.active--; this.pump(); }
  }
  /** Best-effort: start now or return null (used for reasoning summaries). */
  tryRunNow<T>(fn: () => Promise<T>, softCap = 40): Promise<T> | null {
    if (this.queue.length || !this.canStart() || this.windowCount() >= softCap) return null;
    this.active++; this.starts.push(Date.now());
    return fn().finally(() => { this.active--; this.pump(); });
  }
}
// DECISION: smoke-test overrides (§5.5) — 16 concurrent, 300 starts per 60 s, summaries skipped at ≥ 250.
export const SUMMARY_SOFT_CAP = 250;
export const nebiusLimiter = new Limiter(16, 300, 60_000);
