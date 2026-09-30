import type { MoodEngine } from '../engine';
import type { View } from '../render';
import type { PalEvents, TransientMood } from '../types';

/** Everything a built-in watcher can reach. Advanced/internal: prefer plugins for your own code. */
export interface WatchContext {
  win: Window & typeof globalThis;
  doc: Document;
  engine: MoodEngine;
  durations: Record<TransientMood, number>;
  view: View;
  /** The pal's own element, so watchers can ignore interactions with it. */
  host: HTMLElement;
  /** Turn toward an element (no-op when gaze is disabled). */
  lookAt(target: Element): void;
  /** Contribute to the progress ring under `key` (0..1), or withdraw with `null`. */
  progress(key: string, value: number | null): void;
  emit<K extends keyof PalEvents>(event: K, ...args: Parameters<PalEvents[K]>): void;
  on<K extends keyof PalEvents>(event: K, listener: PalEvents[K]): () => void;
  /** Internal "the page did something" pings (e.g. a request started), for dead-click detection. */
  activity: {
    ping(): void;
    subscribe(listener: () => void): () => void;
  };
}

export const isElement = (node: unknown): node is Element =>
  typeof node === 'object' && node !== null && (node as Node).nodeType === 1;
