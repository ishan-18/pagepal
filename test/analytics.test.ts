import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPal } from '../src';
import {
  analytics,
  describeElement,
  sanitizePath,
  sanitizeUrl,
  summarize,
  toGA4,
  toPlausible,
  toPostHog,
  toSegment,
  type UXEvent,
} from '../src/analytics/index';
import { quiet, setOnline } from './helpers';

const beacons: string[] = [];

beforeEach(() => {
  beacons.length = 0;
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn((_url: string, data: Blob) => {
      void data.text().then((text) => beacons.push(text));
      return true;
    }),
  });
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: null });
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined });
});

afterEach(() => {
  delete (navigator as { sendBeacon?: unknown }).sendBeacon;
});

const types = (events: UXEvent[]) => events.map((event) => event.type);
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: 5, clientY: 5 }));

describe('describing things without leaking personal data', () => {
  it('names elements by id, name, test ids and short masked labels', () => {
    document.body.innerHTML = `
      <button id="pay">Pay $49 now</button>
      <button id=":r3:" class="btn primary">Send to jane@example.com</button>
      <input name="email" value="jane@example.com">
      <a data-testid="profile-link" href="/u/1">Jane Doe</a>
      <div data-pagepal-mask><button id="secret">Account 12345</button></div>`;
    const $ = (s: string) => document.querySelector(s)!;
    expect(describeElement($('#pay'))).toBe('button#pay "Pay $## now"');
    expect(describeElement($('.btn'))).toBe('button.btn.primary "Send to [email]"');
    expect(describeElement($('input'))).toBe('input[name="email"]'); // never the value
    expect(describeElement($('a'))).toBe('a[data-testid="profile-link"] "Jane Doe"');
    expect(describeElement($('#secret'))).toBe('button#secret');
    expect(describeElement($('#pay'), false)).toBe('button#pay');
  });

  it('strips queries and id-like path segments', () => {
    expect(sanitizePath('/users/12345/orders/9f8e7d6c5b4a')).toBe('/users/:id/orders/:id');
    expect(sanitizePath('/blog/checkout-v2/jane@example.com')).toBe('/blog/checkout-v2/:id');
    expect(sanitizeUrl('/api/items?token=abc#x', 'https://shop.test/cart')).toBe('/api/items');
    expect(sanitizeUrl('https://api.other.test/v1/users/42?q=1', 'https://shop.test/')).toBe('https://api.other.test/v1/users/:id');
  });
});

describe('recording', () => {
  it('records a page view and frustration events with page and view ids', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="pay">Pay</button>';
    const ux = analytics();
    createPal({ ...quiet, frustration: true, deadClicks: true, plugins: [ux] });
    for (let i = 0; i < 4; i++) click(document.getElementById('pay')!);
    await vi.advanceTimersByTimeAsync(1500);

    const events = ux.events();
    expect(types(events)).toEqual(['page_view', 'rage_click']);
    expect(events[1]).toMatchObject({ element: 'button#pay "Pay"', clicks: 4, page: '/' });
    expect(events[0]!.view).toBe(events[1]!.view);
    expect(events[0]).toMatchObject({ referrer: null, viewport: 'desktop' });
  });

  it('form errors, submits and abandonment', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <form id="signup"><input name="email" type="email" required><input name="name" required></form>
      <form id="newsletter"><input name="topic" required></form>`;
    const ux = analytics();
    const pal = createPal({ ...quiet, watch: ['#signup', '#newsletter'], plugins: [ux] });

    const email = document.querySelector<HTMLInputElement>('[name=email]')!;
    email.dispatchEvent(new Event('invalid'));
    email.value = 'me@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    const name = document.querySelector<HTMLInputElement>('[name=name]')!;
    name.value = 'Me';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('signup')!.dispatchEvent(new Event('submit', { bubbles: true }));
    vi.advanceTimersByTime(0);

    const topic = document.querySelector<HTMLInputElement>('[name=topic]')!;
    topic.value = 'x';
    topic.dispatchEvent(new Event('input', { bubbles: true }));
    topic.value = '';
    topic.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new Event('pagehide')); // left without submitting the newsletter form

    const events = ux.events();
    expect(events.find((e) => e.type === 'form_error')).toMatchObject({
      form: 'form#signup',
      field: 'input[name="email"]',
      validity: 'valueMissing',
      source: 'invalid',
    });
    expect(events.find((e) => e.type === 'form_submit')).toMatchObject({ form: 'form#signup', success: true, errors: 1 });
    const abandons = events.filter((e) => e.type === 'form_abandon');
    expect(abandons).toHaveLength(1);
    expect(abandons[0]).toMatchObject({ form: 'form#newsletter', lastField: 'input[name="topic"]', progress: 0 });
    expect(events[events.length - 1]).toMatchObject({ type: 'page_summary' });
    pal.destroy();
  });

  it('failing and slow requests (sanitized), offline time', async () => {
    vi.useFakeTimers();
    let resolve!: (r: Response) => void;
    window.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
    setOnline(true);
    const ux = analytics({ slowRequestMs: 3000 });
    createPal({ ...quiet, network: true, requests: true, plugins: [ux] });

    await fetch('/api/orders/123?secret=1', { method: 'POST' });
    const slow = fetch('/api/report');
    await vi.advanceTimersByTimeAsync(3500);
    resolve(new Response('ok'));
    await slow;

    setOnline(false);
    await vi.advanceTimersByTimeAsync(4000);
    setOnline(true);

    const events = ux.events();
    expect(events.find((e) => e.type === 'request_error')).toMatchObject({ method: 'POST', url: '/api/orders/:id', status: 500 });
    expect(events.find((e) => e.type === 'request_slow')).toMatchObject({ method: 'GET', url: '/api/report', status: 200 });
    expect(events.find((e) => e.type === 'offline')).toMatchObject({ durationMs: 4000 });
  });

  it('a request cut off by leaving the page is not an error; a real network failure is', async () => {
    vi.useFakeTimers();
    window.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const ux = analytics();
    const pal = createPal({ ...quiet, requests: true, plugins: [ux] });
    const failures: boolean[] = [];
    pal.on('request', (d) => failures.push(d.failed));

    await fetch('/api/a').catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    expect(pal.mood).toBe('wince');

    await fetch('/api/b').catch(() => {});
    window.dispatchEvent(new Event('pagehide')); // user navigated away
    await vi.advanceTimersByTimeAsync(100);
    expect(failures).toEqual([true, false]);
    expect(ux.events().filter((e) => e.type === 'request_error')).toHaveLength(1);
  });

  it('js errors only when included, masked', () => {
    const off = analytics();
    const on = analytics({ include: ['js_error'] });
    createPal({ ...quiet, plugins: [off, on] });
    window.dispatchEvent(new ErrorEvent('error', { message: 'User 4242 not found for bob@example.com', filename: 'https://x.test/app.js?v=1', lineno: 12 }));
    expect(types(off.events())).not.toContain('js_error');
    expect(on.events()).toEqual([
      expect.objectContaining({ type: 'js_error', message: 'User #### not found for [email]', source: 'https://x.test/app.js', line: 12 }),
    ]);
  });

  it('mascot engagement: pokes and dismissals', () => {
    const ux = analytics();
    const pal = createPal({ ...quiet, interactive: true, plugins: [ux] });
    pal.dismiss();
    expect(types(ux.events())).toContain('pal_dismiss');
  });
});

describe('privacy controls', () => {
  it('records nothing until consent, then starts with a page view', () => {
    const ux = analytics({ consent: false });
    const pal = createPal({ ...quiet, plugins: [ux] });
    pal.dismiss();
    expect(ux.events()).toEqual([]);
    ux.consent(true);
    pal.show();
    pal.dismiss();
    expect(types(ux.events())).toEqual(['page_view', 'pal_dismiss']);
    ux.consent(false);
    ux.flush();
    expect(beacons).toEqual([]);
  });

  it('turns off for Do Not Track and Global Privacy Control', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
    const ux = analytics();
    createPal({ ...quiet, plugins: [ux] });
    expect(ux.active).toBe(false);
    expect(ux.events()).toEqual([]);

    const ignoring = analytics({ respectPrivacySignals: false });
    createPal({ ...quiet, plugins: [ignoring] });
    expect(ignoring.active).toBe(true);
  });

  it('samples whole page views', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const out = analytics({ sampleRate: 0.5 });
    const inside = analytics({ sampleRate: 0.8 });
    createPal({ ...quiet, plugins: [out, inside] });
    expect(out.active).toBe(false);
    expect(inside.active).toBe(true);
    random.mockRestore();
  });

  it('redact can scrub or drop events', () => {
    const ux = analytics({
      redact: (event) => (event.type === 'pal_poke' ? null : { ...event, page: '/redacted' }),
    });
    const pal = createPal({ ...quiet, interactive: true, plugins: [ux] });
    pal.element!.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    pal.element!.dispatchEvent(new MouseEvent('pointerup', { button: 0 }));
    expect(types(ux.events())).toEqual(['page_view']);
    expect(ux.events()[0]!.page).toBe('/redacted');
  });
});

describe('delivery', () => {
  it('batches to the endpoint with sendBeacon, and flushes when the page is hidden', async () => {
    vi.useFakeTimers();
    const ux = analytics({ endpoint: '/ux', batchSize: 3, flushInterval: 5000 });
    const pal = createPal({ ...quiet, interactive: true, plugins: [ux] });
    pal.dismiss(); // page_view + dismiss = 2 (below batch size)
    expect(navigator.sendBeacon).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(navigator.sendBeacon).toHaveBeenCalledWith('/ux', expect.any(Blob));
    await vi.waitFor(() => expect(beacons).toHaveLength(1));
    expect(types(JSON.parse(beacons[0]!).events)).toEqual(['page_view', 'pal_dismiss']);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('flushes on the interval and when the batch is full; sends to every sink', () => {
    vi.useFakeTimers();
    const sink = vi.fn();
    const failing = vi.fn(() => {
      throw new Error('down');
    });
    const ux = analytics({ send: [failing, sink], batchSize: 2, flushInterval: 1000 });
    const pal = createPal({ ...quiet, plugins: [ux] });
    vi.advanceTimersByTime(1000);
    expect(sink).toHaveBeenCalledTimes(1); // page_view on the interval
    pal.show().dismiss();
    pal.show().dismiss(); // 2 events → full batch
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[1]![0]).toHaveLength(2);
  });

  it('does not make the pal wait for its own analytics requests', async () => {
    vi.useFakeTimers();
    delete (navigator as { sendBeacon?: unknown }).sendBeacon; // force the fetch fallback
    const original = vi.fn(() => new Promise<Response>(() => {}));
    window.fetch = original;
    const ux = analytics({ endpoint: '/ux' });
    const pal = createPal({ ...quiet, requests: { delay: 0 }, plugins: [ux] });
    ux.flush();
    await vi.advanceTimersByTimeAsync(10);
    expect(original).toHaveBeenCalledWith('/ux', expect.objectContaining({ method: 'POST', keepalive: true }));
    expect(pal.mood).toBe('neutral');
  });

  it('closes out the view when the pal is destroyed (SPA unmount)', () => {
    const sink = vi.fn();
    const ux = analytics({ send: sink });
    const pal = createPal({ ...quiet, plugins: [ux] });
    pal.destroy();
    expect(types(sink.mock.calls.flatMap((call) => call[0] as UXEvent[]))).toEqual(['page_view', 'page_summary']);
  });
});

describe('summarize', () => {
  const base = { ts: 0, page: '/checkout' };
  const events: UXEvent[] = [
    { ...base, view: 'a', type: 'page_view', referrer: null, viewport: 'desktop' },
    { ...base, view: 'a', type: 'rage_click', element: 'button#pay "Pay"', clicks: 5 },
    { ...base, view: 'a', type: 'dead_click', element: 'button#pay "Pay"' },
    { ...base, view: 'a', type: 'form_error', form: 'form#f', field: 'input[name="zip"]', validity: 'patternMismatch', source: 'invalid' },
    { ...base, view: 'a', type: 'form_abandon', form: 'form#f', lastField: 'input[name="zip"]', progress: 0.5, durationMs: 9000, errors: 1 },
    { ...base, view: 'a', type: 'page_summary', durationMs: 20000, waitMs: 3000, counts: {} },
    { ...base, view: 'b', type: 'page_view', referrer: null, viewport: 'mobile' },
    { ...base, view: 'b', type: 'dead_click', element: 'div.card' },
    { ...base, view: 'b', type: 'request_error', method: 'POST', url: '/api/pay', status: 502, durationMs: 800 },
    { ...base, view: 'b', type: 'pal_dismiss' },
    { ...base, view: 'b', type: 'form_submit', form: 'form#f', success: true, durationMs: 4000, errors: 0 },
    { ...base, view: 'b', type: 'page_summary', durationMs: 10000, waitMs: 1000, counts: {} },
    { ...base, view: 'c', type: 'page_view', referrer: null, viewport: 'desktop' },
    { ...base, view: 'c', type: 'offline', durationMs: 5000 },
  ];

  it('finds hotspots, form problems, failing endpoints and rates', () => {
    const summary = summarize(events);
    expect(summary.views).toBe(3);
    expect(summary.frustrationRate).toBeCloseTo(2 / 3);
    expect(summary.dismissRate).toBeCloseTo(1 / 3);
    expect(summary.avgWaitMs).toBe(2000);
    expect(summary.offlineMs).toBe(5000);
    expect(summary.frustration[0]).toEqual({ element: 'button#pay "Pay"', page: '/checkout', rageClicks: 1, deadClicks: 1, total: 2 });
    expect(summary.formErrors[0]).toMatchObject({ field: 'input[name="zip"]', validity: 'patternMismatch', count: 1 });
    expect(summary.forms[0]).toEqual({
      form: 'form#f',
      submits: 1,
      successes: 1,
      abandons: 1,
      errors: 1,
      topAbandonField: 'input[name="zip"]',
    });
    expect(summary.requests[0]).toEqual({ endpoint: 'POST /api/pay', errors: 1, slow: 0, worstMs: 800 });
  });

  it('handles no events', () => {
    expect(summarize([])).toMatchObject({ views: 0, frustrationRate: 0, frustration: [] });
  });
});

describe('adapters', () => {
  const events: UXEvent[] = [
    { type: 'page_view', ts: 1, page: '/', view: 'v', referrer: null, viewport: 'desktop' },
    { type: 'rage_click', ts: 2, page: '/', view: 'v', element: 'button#pay', clicks: 4 },
    { type: 'page_summary', ts: 3, page: '/', view: 'v', durationMs: 10, waitMs: 0, counts: { rage_click: 1 } },
  ];

  it('GA4 gets flat params and no page views', () => {
    const gtag = vi.fn();
    toGA4(gtag)(events);
    expect(gtag.mock.calls).toEqual([
      ['event', 'pagepal_rage_click', { ts: 2, page: '/', element: 'button#pay', clicks: 4 }],
      ['event', 'pagepal_page_summary', { ts: 3, page: '/', durationMs: 10, waitMs: 0, counts_rage_click: 1 }],
    ]);
  });

  it('PostHog, Segment and Plausible', () => {
    const posthog = { capture: vi.fn() };
    const segment = { track: vi.fn() };
    const plausible = vi.fn();
    toPostHog(posthog)(events);
    toSegment(segment)(events);
    toPlausible(plausible)(events);
    expect(posthog.capture).toHaveBeenCalledWith('pagepal_rage_click', expect.objectContaining({ element: 'button#pay' }));
    expect(segment.track).toHaveBeenCalledTimes(2);
    expect(plausible).toHaveBeenCalledWith('pagepal_rage_click', { props: expect.objectContaining({ clicks: 4 }) });
  });
});
