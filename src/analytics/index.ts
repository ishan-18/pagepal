import { asInternal } from '../internal';
import type { PalPlugin, PalPluginAPI } from '../types';
import { describeElement, maskText, sanitizePath, sanitizeUrl } from './describe';
import { summarize } from './summarize';
import type { AnalyticsOptions, Sink, UXEvent, UXEventOf, UXEventType, UXSummary } from './types';

export { toGA4, toPlausible, toPostHog, toSegment } from './adapters';
export { describeElement, maskText, sanitizePath, sanitizeUrl } from './describe';
export { summarize } from './summarize';
export type { AnalyticsOptions, Sink, UXEvent, UXEventOf, UXEventType, UXSummary } from './types';

/** A plugin (pass it to `use()` or `plugins`) with controls for consent and delivery. */
export interface Analytics extends PalPlugin {
  /** Grant or revoke consent. Revoking drops anything not yet sent. */
  consent(granted: boolean): void;
  /** Send queued events now. */
  flush(): void;
  /** Events recorded during this page view (last 500), for local dashboards and debugging. */
  events(): UXEvent[];
  /** `summarize(events())`. */
  summary(): UXSummary;
  /** Whether this page view is being recorded (installed, sampled in, no privacy signal). */
  readonly active: boolean;
}

const DEFAULT_EXCLUDED: UXEventType[] = ['js_error'];
const MAX_LOG = 500;
const MAX_BEACON_CHARS = 60_000;

type Payload<T extends UXEventType> = Omit<UXEventOf<T>, 'type' | 'ts' | 'page' | 'view'>;

interface FormState {
  started: number;
  lastField: string | null;
  progress: number | null;
  errors: number;
  submitted: boolean;
}

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const privacySignal = (win: Window) => {
  const nav = win.navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const dnt = nav.doNotTrack ?? (win as { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
};

const viewportOf = (win: Window) => (win.innerWidth < 640 ? 'mobile' : win.innerWidth < 1024 ? 'tablet' : 'desktop');

/**
 * First-party UX analytics: rage and dead clicks, form errors and abandonment,
 * failing and slow requests, offline time and mascot engagement — sent only
 * where you point it (`endpoint` and/or `send`). Nothing leaves the page by default.
 *
 * ```ts
 * const ux = analytics({ endpoint: '/api/ux' });
 * createPal({ watch: 'form#signup', requests: true, plugins: [ux] });
 * ```
 */
export function analytics(options: AnalyticsOptions = {}): Analytics {
  const {
    endpoint,
    captureText = true,
    slowRequestMs = 3000,
    batchSize = 20,
    flushInterval = 5000,
    respectPrivacySignals = true,
    sampleRate = 1,
  } = options;
  const sinks = ([] as (Sink | undefined)[]).concat(options.send).filter((sink): sink is Sink => !!sink);
  const included = (type: UXEventType) =>
    options.include ? options.include.includes(type) : !DEFAULT_EXCLUDED.includes(type);

  let granted = options.consent ?? true;
  let active = false;
  let win: (Window & typeof globalThis) | null = null;
  let view = '';
  let viewStart = 0;
  let viewRecorded = false;
  let finalized = false;
  let queue: UXEvent[] = [];
  let log: UXEvent[] = [];
  let counts: Partial<Record<UXEventType, number>> = {};
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let forms = new Map<HTMLFormElement, FormState>();
  let waitingSince: number | null = null;
  let waitMs = 0;

  const describe = (el: Element) => describeElement(el, captureText);
  const url = (value: string) => (win ? sanitizeUrl(value, win.location.href) : value);

  const deliver = (batch: UXEvent[]) => {
    for (const sink of sinks) {
      try {
        const result = sink(batch);
        if (result && typeof (result as Promise<unknown>).catch === 'function') (result as Promise<unknown>).catch(() => {});
      } catch {
        // A broken sink must not break the page.
      }
    }
    if (endpoint && win) sendToEndpoint(win, endpoint, batch);
  };

  const flush = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    deliver(batch);
  };

  const startView = () => {
    view = randomId();
    viewStart = Date.now();
    viewRecorded = false;
    finalized = false;
    counts = {};
    forms = new Map();
    waitMs = 0;
    waitingSince = null;
  };

  function record<T extends UXEventType>(type: T, data: Payload<T>): void {
    if (!active || !granted || !win || !included(type)) return;
    if (!viewRecorded && type !== 'page_view') recordPageView();
    let event = { type, ts: Date.now(), page: sanitizePath(win.location.pathname), view, ...data } as UXEvent;
    if (options.redact) {
      const redacted = options.redact(event);
      if (redacted === null) return;
      if (redacted) event = redacted;
    }
    counts[type] = (counts[type] ?? 0) + 1;
    log.push(event);
    if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
    queue.push(event);
    if (queue.length >= batchSize) flush();
    else if (flushTimer === undefined) flushTimer = setTimeout(flush, flushInterval);
  }

  function recordPageView() {
    if (!win) return;
    viewRecorded = true;
    const referrer = win.document.referrer;
    let origin: string | null = null;
    try {
      origin = referrer ? new URL(referrer).origin : null;
    } catch {
      // ignore malformed referrers
    }
    record('page_view', { referrer: origin, viewport: viewportOf(win) });
  }

  /** Close out the view: abandoned forms, a summary, and send everything (the page may be going away). */
  const finalize = () => {
    if (!active || !granted || finalized) return flush();
    finalized = true;
    const now = Date.now();
    for (const [form, state] of forms) {
      if (state.submitted) continue;
      record('form_abandon', {
        form: describe(form),
        lastField: state.lastField,
        progress: state.progress,
        durationMs: now - state.started,
        errors: state.errors,
      });
    }
    forms.clear();
    if (waitingSince !== null) waitMs += now - waitingSince;
    waitingSince = now;
    record('page_summary', { durationMs: now - viewStart, waitMs, counts: { ...counts } });
    flush();
  };

  const formState = (form: HTMLFormElement) => {
    let state = forms.get(form);
    if (!state) {
      state = { started: Date.now(), lastField: null, progress: null, errors: 0, submitted: false };
      forms.set(form, state);
    }
    return state;
  };

  const install = (api: PalPluginAPI) => {
    win = api.window;
    const w = api.window;
    if (respectPrivacySignals && privacySignal(w)) return;
    if (Math.random() >= sampleRate) return;
    active = true;
    startView();
    if (granted) recordPageView();

    api.on('frustration', (detail) => {
      if (detail.kind === 'rage-click') record('rage_click', { element: describe(detail.target), clicks: detail.clicks });
      else record('dead_click', { element: describe(detail.target) });
    });
    api.on('formError', ({ form, field, source, validity }) => {
      if (form) {
        const state = formState(form);
        state.errors++;
        state.lastField = describe(field);
      }
      record('form_error', { form: form ? describe(form) : '', field: describe(field), validity, source });
    });
    api.on('formProgress', ({ form, field, progress }) => {
      const state = formState(form);
      state.lastField = describe(field);
      state.progress = progress;
    });
    api.on('formSubmit', ({ form, success }) => {
      const state = formState(form);
      record('form_submit', {
        form: describe(form),
        success,
        durationMs: Date.now() - state.started,
        errors: state.errors,
      });
      if (success) state.submitted = true;
    });
    api.on('request', (detail) => {
      const data = { method: detail.method, url: url(detail.url), status: detail.status, durationMs: detail.duration };
      if (detail.failed) record('request_error', data);
      else if (!detail.aborted && detail.duration >= slowRequestMs) record('request_slow', data);
    });
    api.on('connection', (detail) => {
      if (detail.online && detail.offlineMs !== undefined) record('offline', { durationMs: detail.offlineMs });
    });
    api.on('change', (mood, previous) => {
      const now = Date.now();
      if (mood === 'waiting') waitingSince = now;
      else if (previous === 'waiting' && waitingSince !== null) {
        waitMs += now - waitingSince;
        waitingSince = null;
      }
    });
    api.on('dismiss', () => record('pal_dismiss', {}));
    api.on('poke', () => record('pal_poke', {}));

    const onError = (event: ErrorEvent) => {
      let source: string | null = null;
      try {
        source = event.filename ? sanitizeUrl(event.filename, w.location.href) : null;
      } catch {
        // ignore
      }
      record('js_error', { message: maskText(String(event.message ?? 'Error'), 200), source, line: event.lineno || null });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: unknown } | undefined;
      record('js_error', { message: maskText(String(reason?.message ?? reason ?? 'Unhandled rejection'), 200), source: null, line: null });
    };
    const onHidden = () => {
      if (w.document.visibilityState === 'hidden') flush();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Restored from the back/forward cache: that's a new view.
      if (!event.persisted) return;
      startView();
      if (granted) recordPageView();
    };

    if (included('js_error')) {
      w.addEventListener('error', onError);
      w.addEventListener('unhandledrejection', onRejection);
    }
    w.addEventListener('pagehide', finalize);
    w.addEventListener('pageshow', onPageShow);
    w.document.addEventListener('visibilitychange', onHidden);

    return () => {
      w.removeEventListener('error', onError);
      w.removeEventListener('unhandledrejection', onRejection);
      w.removeEventListener('pagehide', finalize);
      w.removeEventListener('pageshow', onPageShow);
      w.document.removeEventListener('visibilitychange', onHidden);
      // Unmounted (SPA route change, pal.destroy()): close out this view.
      finalize();
      active = false;
    };
  };

  const plugin = install as Analytics;
  Object.defineProperty(plugin, 'active', { get: () => active });
  plugin.consent = (value) => {
    granted = value;
    if (!value) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
      queue = [];
    } else if (active && !viewRecorded) {
      recordPageView();
    }
  };
  plugin.flush = flush;
  plugin.events = () => [...log];
  plugin.summary = () => summarize(log);
  return plugin;
}

/** `sendBeacon` survives page unload; `text/plain` avoids a CORS preflight. Falls back to keepalive fetch. */
function sendToEndpoint(win: Window & typeof globalThis, endpoint: string, batch: UXEvent[]): void {
  const body = JSON.stringify({ events: batch });
  if (body.length > MAX_BEACON_CHARS && batch.length > 1) {
    const half = Math.ceil(batch.length / 2);
    sendToEndpoint(win, endpoint, batch.slice(0, half));
    sendToEndpoint(win, endpoint, batch.slice(half));
    return;
  }
  const type = 'text/plain;charset=UTF-8';
  try {
    if (win.navigator.sendBeacon?.(endpoint, new Blob([body], { type }))) return;
  } catch {
    // fall through to fetch
  }
  try {
    asInternal(() =>
      win.fetch?.(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': type } })?.catch(() => {}),
    );
  } catch {
    // Delivery is best effort.
  }
}
