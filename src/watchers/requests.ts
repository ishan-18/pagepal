import { internalRequests } from '../internal';
import type { RequestDetail, RequestOutcome, Unwatch, WatchRequestsOptions } from '../types';
import type { WatchContext } from './context';

let nextId = 0;

const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';
const defaultIsError = (res: RequestOutcome) => res.status >= 500;

type Finish = Omit<RequestDetail, 'duration' | 'kind' | 'method' | 'url'>;

export interface RequestTracker {
  /** Call when a request starts; call the returned function when it ends. */
  begin(kind: RequestDetail['kind'], method: string, url: string): (result: Finish) => void;
  dispose(): void;
}

/** Counts in-flight requests: waiting while any are pending (after `delay`), wince on failures. */
export function createTracker(ctx: WatchContext, delay = 150): RequestTracker {
  const { engine, durations } = ctx;
  const id = nextId++;
  const waitKey = `requests#${id}`;
  const errorKey = `request-error#${id}`;
  let pending = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let leftAt: number | null = null;
  const settleTimers = new Set<ReturnType<typeof setTimeout>>();
  const onPageHide = () => (leftAt = Date.now());
  ctx.win.addEventListener('pagehide', onPageHide);

  return {
    begin(kind, method, url) {
      ctx.activity.ping();
      const started = Date.now();
      if (++pending === 1) timer = setTimeout(() => engine.set(waitKey, 'waiting'), delay);
      let ended = false;

      const settle = (result: Finish, endedAt: number) => {
        pending = Math.max(0, pending - 1);
        if (pending === 0) {
          clearTimeout(timer);
          engine.clear(waitKey);
        }
        if (result.failed) engine.set(errorKey, 'wince', durations.wince);
        ctx.emit('request', { kind, method, url, duration: endedAt - started, ...result });
      };

      return (result) => {
        if (ended) return;
        ended = true;
        const endedAt = Date.now();
        if (!(result.failed && result.status === 0)) return settle(result, endedAt);
        // A request cut off because the user is leaving looks exactly like a network
        // failure. Wait a moment: if the page is going away, it was the navigation.
        const check = setTimeout(() => {
          settleTimers.delete(check);
          const leaving = leftAt !== null && leftAt >= endedAt - 100;
          settle(leaving ? { ...result, failed: false, aborted: true } : result, endedAt);
        }, 100);
        settleTimers.add(check);
      };
    },
    dispose() {
      clearTimeout(timer);
      settleTimers.forEach(clearTimeout);
      ctx.win.removeEventListener('pagehide', onPageHide);
      engine.clear(waitKey);
      engine.clear(errorKey);
    },
  };
}

const describeFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const request = typeof input === 'object' && 'url' in input ? input : null;
  const url = typeof input === 'string' ? input : request ? request.url : String(input);
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  return { url, method };
};

/** Patch `window.fetch`. */
export function watchFetch(
  ctx: WatchContext,
  { filter, isError = defaultIsError }: WatchRequestsOptions,
  tracker: RequestTracker,
): Unwatch {
  const { win } = ctx;
  const original = win.fetch;
  if (typeof original !== 'function') return () => {};
  let active = true;

  const patched: typeof fetch = (input, init) => {
    if (!active || internalRequests.depth > 0 || (filter && !filter(input, init))) {
      return original.call(win, input, init);
    }

    const { url, method } = describeFetch(input, init);
    const end = tracker.begin('fetch', method, url);
    let request: Promise<Response>;
    try {
      request = original.call(win, input, init);
    } catch (error) {
      end({ status: 0, ok: false, failed: true, aborted: false });
      throw error;
    }
    return request.then(
      (response) => {
        end({ status: response.status, ok: response.ok, failed: isError(response), aborted: false });
        return response;
      },
      (error: unknown) => {
        const aborted = isAbort(error);
        end({ status: 0, ok: false, failed: !aborted, aborted });
        throw error;
      },
    );
  };

  win.fetch = patched;

  return () => {
    active = false;
    // Only restore if nobody wrapped fetch after us; otherwise `patched` stays as a passthrough.
    if (win.fetch === patched) win.fetch = original;
  };
}

/** Patch `XMLHttpRequest` (used by axios and older libraries). */
export function watchXHR(
  ctx: WatchContext,
  { filter, isError = defaultIsError, progress: minBytes = 100_000 }: WatchRequestsOptions,
  tracker: RequestTracker,
): Unwatch {
  const XHR = ctx.win.XMLHttpRequest;
  if (typeof XHR !== 'function') return () => {};

  const proto = XHR.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
  const progressKey = `xhr-progress#${nextId++}`;
  const transfers = new Map<object, { loaded: number; total: number }>();
  let active = true;

  const updateProgress = () => {
    let loaded = 0;
    let total = 0;
    for (const transfer of transfers.values()) {
      loaded += transfer.loaded;
      total += transfer.total;
    }
    ctx.progress(progressKey, total > 0 ? loaded / total : null);
  };

  /** Large, measurable transfers feed the progress ring. */
  const trackProgress = (source: EventTarget | null | undefined) => {
    if (!source || minBytes === false) return;
    source.addEventListener('progress', (event) => {
      const { lengthComputable, loaded, total } = event as ProgressEvent;
      if (!lengthComputable || total < minBytes) return;
      transfers.set(source, { loaded, total });
      updateProgress();
    });
  };

  const open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    meta.set(this, { method: String(method).toUpperCase(), url: String(url) });
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as XMLHttpRequest['open'];

  const send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const info = meta.get(this) ?? { method: 'GET', url: '' };
    if (!active || internalRequests.depth > 0 || (filter && !filter(info.url, { method: info.method }))) {
      return originalSend.call(this, body);
    }

    let aborted = false;
    const end = tracker.begin('xhr', info.method, info.url);
    trackProgress(this);
    trackProgress(this.upload);
    this.addEventListener('abort', () => (aborted = true), { once: true });
    this.addEventListener(
      'loadend',
      () => {
        const status = this.status;
        const outcome = { status, ok: status >= 200 && status < 300, url: this.responseURL || info.url };
        const failed = !aborted && (status === 0 || isError(outcome));
        transfers.delete(this);
        if (this.upload) transfers.delete(this.upload);
        updateProgress();
        end({ status, ok: outcome.ok, failed, aborted });
      },
      { once: true },
    );
    try {
      return originalSend.call(this, body);
    } catch (error) {
      end({ status: 0, ok: false, failed: true, aborted: false });
      throw error;
    }
  };

  proto.open = open;
  proto.send = send;

  return () => {
    active = false;
    if (proto.open === open) proto.open = originalOpen;
    if (proto.send === send) proto.send = originalSend;
    transfers.clear();
    ctx.progress(progressKey, null);
  };
}

export type RequestKind = 'fetch' | 'xhr';

/** Watch the given request APIs with one shared in-flight counter. */
export function watchRequests(
  ctx: WatchContext,
  kinds: RequestKind[],
  options: WatchRequestsOptions = {},
): Unwatch {
  const tracker = createTracker(ctx, options.delay);
  const unwatchers = kinds.map((kind) =>
    kind === 'fetch' ? watchFetch(ctx, options, tracker) : watchXHR(ctx, options, tracker),
  );
  return () => {
    unwatchers.forEach((unwatch) => unwatch());
    tracker.dispose();
  };
}
