import type { PalOptions } from '../src';

type Listener = (event: { matches: boolean }) => void;

/** Every automatic watcher and interaction off, so each test enables only what it checks. */
export const quiet: PalOptions = {
  scroll: false,
  network: false,
  darkMode: false,
  idle: false,
  password: false,
  frustration: false,
  copy: false,
  welcomeBack: false,
  interactive: false,
  remember: false,
};

/** jsdom has no matchMedia; this stub lets tests flip `prefers-color-scheme`. */
export function installMatchMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  };
  window.matchMedia = ((media: string) =>
    media.includes('prefers-color-scheme: dark')
      ? query
      : { matches: false, media, addEventListener() {}, removeEventListener() {} }) as never;

  return {
    setDark(value: boolean) {
      dark = value;
      listeners.forEach((fn) => fn({ matches: value }));
    },
    listenerCount: () => listeners.size,
  };
}

export function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

export function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Let MutationObserver callbacks (microtasks) run. */
export const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

/** A controllable stand-in for XMLHttpRequest (jsdom's does real network I/O). */
export class FakeXHR extends EventTarget {
  static instances: FakeXHR[] = [];
  status = 0;
  responseURL = '';
  method = '';
  url = '';

  constructor() {
    super();
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send() {}
  respond(status: number) {
    this.status = status;
    this.responseURL = this.url;
    this.dispatchEvent(new Event('load'));
    this.dispatchEvent(new Event('loadend'));
  }
  fail() {
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new Event('loadend'));
  }
  abort() {
    this.dispatchEvent(new Event('abort'));
    this.dispatchEvent(new Event('loadend'));
  }
}

export function installFakeXHR() {
  FakeXHR.instances = [];
  const original = window.XMLHttpRequest;
  window.XMLHttpRequest = FakeXHR as never;
  return () => {
    window.XMLHttpRequest = original;
  };
}

/** Pointer events without relying on jsdom's PointerEvent support. */
export function pointer(target: EventTarget, type: string, x = 0, y = 0) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, button: 0 }));
}

export function stubRect(el: Element, left: number, top: number, width = 10, height = 10) {
  el.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
}
