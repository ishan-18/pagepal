export type UXEventType =
  | 'page_view'
  | 'rage_click'
  | 'dead_click'
  | 'form_error'
  | 'form_submit'
  | 'form_abandon'
  | 'request_error'
  | 'request_slow'
  | 'offline'
  | 'js_error'
  | 'pal_dismiss'
  | 'pal_poke'
  | 'page_summary';

interface Base<T extends UXEventType> {
  type: T;
  /** Epoch ms. */
  ts: number;
  /** Sanitized path of the page (no query/hash; id-like segments become `:id`). */
  page: string;
  /** Random id for this page view; not persisted, not linked across pages. */
  view: string;
}

export type UXEvent =
  | (Base<'page_view'> & { referrer: string | null; viewport: 'mobile' | 'tablet' | 'desktop' })
  | (Base<'rage_click'> & { element: string; clicks: number })
  | (Base<'dead_click'> & { element: string })
  | (Base<'form_error'> & { form: string; field: string; validity: string | null; source: string })
  | (Base<'form_submit'> & { form: string; success: boolean; durationMs: number; errors: number })
  | (Base<'form_abandon'> & {
      form: string;
      lastField: string | null;
      progress: number | null;
      durationMs: number;
      errors: number;
    })
  | (Base<'request_error'> & { method: string; url: string; status: number; durationMs: number })
  | (Base<'request_slow'> & { method: string; url: string; status: number; durationMs: number })
  | (Base<'offline'> & { durationMs: number })
  | (Base<'js_error'> & { message: string; source: string | null; line: number | null })
  | (Base<'pal_dismiss'> & {})
  | (Base<'pal_poke'> & {})
  | (Base<'page_summary'> & { durationMs: number; waitMs: number; counts: Partial<Record<UXEventType, number>> });

export type UXEventOf<T extends UXEventType> = Extract<UXEvent, { type: T }>;

/** Where batches go. May return a promise; failures are ignored. */
export type Sink = (events: UXEvent[]) => void | Promise<unknown>;

export interface AnalyticsOptions {
  /** POST batches here as `{"events":[...]}` (via `sendBeacon`, `text/plain` so no CORS preflight). */
  endpoint?: string;
  /** Your own delivery, or adapters like `toPostHog(posthog)`. */
  send?: Sink | Sink[];
  /** Record nothing until `consent(true)`. Default `true` (consent assumed); set `false` behind a consent banner. */
  consent?: boolean;
  /** Turn off entirely when the browser sends Do Not Track or Global Privacy Control. Default `true`. */
  respectPrivacySignals?: boolean;
  /** Share of page views to record (decided once per view). Default `1`. */
  sampleRate?: number;
  /** Event types to record. Default: everything except `js_error` (error messages can contain personal data). */
  include?: UXEventType[];
  /** Include short, masked labels of clicked elements (e.g. `"Pay $##"`). Default `true`. */
  captureText?: boolean;
  /** Requests slower than this are reported as `request_slow`. Default `3000`. */
  slowRequestMs?: number;
  /** Send when this many events are queued. Default `20`. */
  batchSize?: number;
  /** Send queued events at least this often, in ms. Default `5000`. */
  flushInterval?: number;
  /** Last chance to scrub or drop (return `null`) an event. */
  redact?: (event: UXEvent) => UXEvent | null | undefined | void;
}

export interface UXSummary {
  views: number;
  counts: Partial<Record<UXEventType, number>>;
  /** Share of views with at least one rage or dead click. */
  frustrationRate: number;
  /** Share of views where the mascot was dismissed. */
  dismissRate: number;
  /** Average time per view spent waiting on requests. */
  avgWaitMs: number;
  offlineMs: number;
  /** Elements people struggle with most. */
  frustration: { element: string; page: string; rageClicks: number; deadClicks: number; total: number }[];
  formErrors: { form: string; field: string; validity: string | null; count: number }[];
  forms: {
    form: string;
    submits: number;
    successes: number;
    abandons: number;
    errors: number;
    /** Field most often touched last before abandoning. */
    topAbandonField: string | null;
  }[];
  requests: { endpoint: string; errors: number; slow: number; worstMs: number }[];
}
