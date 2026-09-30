import type { Mood, SignalInfo } from './types';

/** Higher wins when several signals are active at once. */
export const DEFAULT_PRIORITIES: Record<Mood, number> = {
  cheer: 90,
  wink: 88,
  wince: 85,
  dizzy: 80,
  concerned: 75,
  confused: 74,
  sad: 70,
  shy: 65,
  waiting: 60,
  dozing: 40,
  sleepy: 20,
  neutral: 0,
};

interface Signal {
  mood: Mood;
  expiresAt: number | null;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Arbitrates between everything the page is telling the pal.
 *
 * Each watcher owns a signal key (e.g. `'fetch'`, `'network'`). Setting a key
 * replaces that watcher's previous signal; an optional duration makes it expire.
 * The visible mood is the highest-priority active signal, ties going to the
 * most recently set one.
 */
export class MoodEngine {
  private signals = new Map<string, Signal>();
  private current: Mood = 'neutral';
  private priorities: Record<Mood, number>;

  constructor(
    private onChange: (mood: Mood, previous: Mood) => void,
    priorities: Partial<Record<Mood, number>> = {},
  ) {
    this.priorities = { ...DEFAULT_PRIORITIES, ...priorities };
  }

  get mood(): Mood {
    return this.current;
  }

  set(key: string, mood: Mood, duration?: number): void {
    this.cancel(key);
    const signal: Signal = { mood, expiresAt: null };
    // No, zero or infinite duration: hold until cleared.
    if (duration !== undefined && duration > 0 && Number.isFinite(duration)) {
      signal.expiresAt = Date.now() + duration;
      signal.timer = setTimeout(() => this.clear(key), duration);
    }
    this.signals.set(key, signal);
    this.resolve();
  }

  clear(key: string): void {
    if (!this.signals.has(key)) return;
    this.cancel(key);
    this.resolve();
  }

  has(key: string): boolean {
    return this.signals.has(key);
  }

  /** Active signals, highest priority first. */
  snapshot(): SignalInfo[] {
    return [...this.signals]
      .map(([key, { mood, expiresAt }]) => ({ key, mood, priority: this.priorities[mood], expiresAt }))
      .sort((a, b) => b.priority - a.priority);
  }

  dispose(): void {
    for (const key of [...this.signals.keys()]) this.cancel(key);
  }

  private cancel(key: string): void {
    const existing = this.signals.get(key);
    if (existing?.timer !== undefined) clearTimeout(existing.timer);
    this.signals.delete(key);
  }

  private resolve(): void {
    let winner: Mood = 'neutral';
    let best = -Infinity;
    // Map preserves insertion order, and `set` re-inserts, so `>=` favors the newest.
    for (const { mood } of this.signals.values()) {
      const priority = this.priorities[mood];
      if (priority >= best) {
        best = priority;
        winner = mood;
      }
    }
    if (winner !== this.current) {
      const previous = this.current;
      this.current = winner;
      this.onChange(winner, previous);
    }
  }
}
