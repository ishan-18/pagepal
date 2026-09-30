import { blob } from './characters';
import { resolveColor } from './color';
import { MoodEngine } from './engine';
import { makeInteractive } from './interact';
import { createView, type View } from './render';
import { isImages } from './render/characters';
import { createStore, type Store } from './storage';
import {
  WATCHER,
  type Mood,
  type PalCoreOptions,
  type PalEvents,
  type PalPlugin,
  type PalPluginAPI,
  type TransientMood,
  type Unwatch,
  type Watcher,
} from './types';
import { isElement, type WatchContext } from './watchers/context';

const DEFAULT_DURATIONS: Record<TransientMood, number> = {
  cheer: 1800,
  wince: 1200,
  dizzy: 1200,
  wink: 900,
  concerned: 1800,
  confused: 1600,
};

const DEFAULT_GAZE_MS = 2500;

type AnyListener = (...args: never[]) => void;

let nextPluginId = 0;

/**
 * The pal without any built-in watchers. Add the ones you need from
 * `pagepal/watchers` so your bundle only carries those.
 */
export class PalCore {
  protected engine: MoodEngine;
  protected view: View | null = null;
  protected ctx: WatchContext | null = null;
  protected destroyed = false;
  private store: Store | null = null;
  private listeners = new Map<keyof PalEvents, Set<AnyListener>>();
  private unwatchers = new Set<Unwatch>();
  private durations: Record<TransientMood, number>;
  private gazeMs: number;
  private gazeTimer: ReturnType<typeof setTimeout> | undefined;
  private progressSources = new Map<string, number>();
  private activityListeners = new Set<() => void>();

  constructor(options: PalCoreOptions = {}) {
    this.engine = new MoodEngine((mood, previous) => {
      this.view?.setMood(mood);
      this.emit('change', mood, previous);
    }, options.priorities);
    this.durations = { ...DEFAULT_DURATIONS, ...options.durations };
    const gaze = options.gaze !== false;
    this.gazeMs = (typeof options.gaze === 'object' && options.gaze.duration) || DEFAULT_GAZE_MS;

    // No DOM (SSR, workers): stay inert but keep the API callable.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const character = options.character ?? blob;
    const position = options.position ?? 'bottom-right';
    const size = options.size ?? 72;
    const interactive = options.interactive ?? true;

    const view = createView(document, {
      container: options.container ?? document.body ?? document.documentElement,
      position,
      size,
      offset: options.offset ?? 20,
      color: resolveColor(document, window, options.color, isImages(character) ? blob.color : character.color),
      zIndex: options.zIndex ?? 2147483000,
      character,
      interactive,
      keyboard: options.keyboard ?? true,
      dismissLabel: options.labels?.dismiss ?? 'Hide mascot',
    });
    this.view = view;

    const store = createStore(window, options.storageKey ?? 'pagepal', options.remember ?? true);
    this.store = store;
    const saved = store.read();
    if (saved.dismissed) view.setHidden(true);

    this.ctx = {
      win: window,
      doc: document,
      engine: this.engine,
      durations: this.durations,
      view,
      host: view.host,
      lookAt: (target) => {
        if (gaze) this.lookAt(target);
      },
      progress: (key, value) => this.setProgressSource(key, value),
      emit: (event, ...args) => this.emit(event, ...args),
      on: (event, listener) => this.on(event, listener),
      activity: {
        ping: () => this.activityListeners.forEach((listener) => listener()),
        subscribe: (listener) => {
          this.activityListeners.add(listener);
          return () => void this.activityListeners.delete(listener);
        },
      },
    };

    if (interactive) {
      this.track(
        makeInteractive(window, view, {
          size,
          draggable: position !== 'inline',
          initialPosition: saved.position,
          onPoke: () => {
            this.engine.set('poke', 'wink', this.durations.wink);
            this.emit('poke');
          },
          onDismiss: () => this.dismiss(),
          onMoved: (moved) => store.write({ position: moved }),
        }),
      );
    }

    for (const plugin of options.plugins ?? []) this.use(plugin);
  }

  /** The mood currently shown. */
  get mood(): Mood {
    return this.engine.mood;
  }

  /** The pal's host element (`null` when there is no DOM). */
  get element(): HTMLElement | null {
    return this.view?.host ?? null;
  }

  /** Whether the pal is hidden (by `hide()`, `dismiss()` or the user). */
  get hidden(): boolean {
    return this.view?.host.hidden ?? true;
  }

  /**
   * Show a mood on demand. Without a duration, transient moods (`cheer`, `wince`,
   * `dizzy`, `wink`, `concerned`, `confused`) use their default durations and other
   * moods hold; pass `Infinity` to hold any mood. `react(null)` clears it.
   */
  react(mood: Mood | null, duration?: number): this {
    if (mood === null) this.engine.clear('manual');
    else if (!this.destroyed) this.engine.set('manual', mood, duration ?? this.durations[mood as TransientMood]);
    return this;
  }

  /**
   * Raise your own signal (e.g. an upload in progress). Unlike `react()`, each key
   * is independent, so several can be active at once. Holds until cleared unless
   * you pass a duration.
   */
  signal(key: string, mood: Mood, duration?: number): this {
    if (!this.destroyed) this.engine.set(`user:${key}`, mood, duration);
    return this;
  }

  clearSignal(key: string): this {
    this.engine.clear(`user:${key}`);
    return this;
  }

  /** Show a progress ring (0..1), or remove it with `null`. */
  progress(value: number | null): this {
    this.setProgressSource('manual', value);
    return this;
  }

  /** Turn toward an element or viewport point. `null` looks straight ahead again. */
  lookAt(target: Element | { x: number; y: number } | null, duration = this.gazeMs): this {
    const view = this.view;
    if (!view) return this;
    clearTimeout(this.gazeTimer);
    if (target === null) {
      view.look(0, 0);
      return this;
    }

    const rect = isElement(target) ? target.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : (target as { x: number }).x;
    const y = rect ? rect.top + rect.height / 2 : (target as { y: number }).y;
    const own = view.host.getBoundingClientRect();
    const dx = x - (own.left + own.width / 2);
    const dy = y - (own.top + own.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance < 1) view.look(0, 0);
    else view.look(dx / distance, dy / distance);

    if (Number.isFinite(duration) && duration > 0) {
      this.gazeTimer = setTimeout(() => view.look(0, 0), duration);
    }
    return this;
  }

  /** Show a speech bubble. */
  say(text: string, duration = 2500): this {
    this.view?.say(text, duration);
    return this;
  }

  /**
   * Add a plugin (your own function, or e.g. `analytics()`) or a built-in watcher
   * from `pagepal/watchers`. Returns a function that removes it.
   */
  use(plugin: PalPlugin | Watcher): Unwatch {
    const ctx = this.ctx;
    if (!ctx) return () => {};
    if (typeof plugin !== 'function') return this.track(plugin[WATCHER](ctx));

    const prefix = `plugin#${nextPluginId++}:`;
    const keys = new Set<string>();
    const offs: (() => void)[] = [];
    const progressKey = `${prefix}progress`;
    const self = this;
    const api: PalPluginAPI = {
      window: ctx.win,
      document: ctx.doc,
      durations: this.durations,
      element: ctx.host,
      get mood() {
        return self.mood;
      },
      signal: (key, mood, duration) => {
        if (this.destroyed) return;
        keys.add(key);
        this.engine.set(prefix + key, mood, duration);
      },
      clear: (key) => {
        keys.delete(key);
        this.engine.clear(prefix + key);
      },
      signals: () => this.engine.snapshot(),
      progress: (value) => this.setProgressSource(progressKey, value),
      lookAt: (target, duration) => void this.lookAt(target, duration),
      say: (text, duration) => void this.say(text, duration),
      on: (event, listener) => {
        const off = this.on(event, listener);
        offs.push(off);
        return off;
      },
    };

    const cleanup = plugin(api);
    return this.track(() => {
      if (typeof cleanup === 'function') cleanup();
      offs.forEach((off) => off());
      keys.forEach((key) => this.engine.clear(prefix + key));
      this.setProgressSource(progressKey, null);
    });
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof PalEvents>(event: K, listener: PalEvents[K]): () => void {
    if (this.destroyed) return () => {};
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    const stored = set;
    stored.add(listener as AnyListener);
    return () => void stored.delete(listener as AnyListener);
  }

  /** Hide the pal for now (not remembered). Watchers keep running. */
  hide(): this {
    this.view?.setHidden(true);
    return this;
  }

  /** Show the pal again, clearing a remembered dismissal. */
  show(): this {
    this.view?.setHidden(false);
    this.store?.write({ dismissed: false });
    return this;
  }

  /** What the close button does: hide and remember it for this site. */
  dismiss(): this {
    if (!this.view || this.view.host.hidden) return this;
    this.view.setHidden(true);
    this.store?.write({ dismissed: true });
    this.emit('dismiss');
    return this;
  }

  /** Stop all watchers and plugins and remove the pal from the page. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unwatchers.forEach((unwatch) => unwatch());
    this.unwatchers.clear();
    clearTimeout(this.gazeTimer);
    this.engine.dispose();
    this.view?.destroy();
    this.view = null;
    this.ctx = null;
    this.activityListeners.clear();
    this.listeners.clear();
  }

  protected emit<K extends keyof PalEvents>(event: K, ...args: Parameters<PalEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) (listener as (...a: unknown[]) => void)(...args);
  }

  protected track(unwatch: Unwatch): Unwatch {
    if (this.destroyed) {
      unwatch();
      return () => {};
    }
    const once = () => {
      if (this.unwatchers.delete(once)) unwatch();
    };
    this.unwatchers.add(once);
    return once;
  }

  private setProgressSource(key: string, value: number | null): void {
    if (value === null) this.progressSources.delete(key);
    else this.progressSources.set(key, value);
    const values = [...this.progressSources.values()];
    this.view?.setProgress(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  }
}

/** Create a pal with no built-in watchers; add them via `plugins`. */
export function createPalCore(options?: PalCoreOptions): PalCore {
  return new PalCore(options);
}
