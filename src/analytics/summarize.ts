import type { UXEvent, UXEventOf, UXEventType, UXSummary } from './types';

const TOP = 10;

const byTotal = <T>(map: Map<string, T>, score: (item: T) => number) =>
  [...map.values()].sort((a, b) => score(b) - score(a)).slice(0, TOP);

const of = <T extends UXEventType>(events: UXEvent[], type: T) =>
  events.filter((event): event is UXEventOf<T> => event.type === type);

/**
 * Turn raw events (from any number of page views) into dashboard numbers:
 * frustration hotspots, form errors and abandonment, failing endpoints.
 */
export function summarize(events: UXEvent[]): UXSummary {
  const counts: Partial<Record<UXEventType, number>> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;

  const views = new Set(events.map((event) => event.view));
  const viewCount = Math.max(views.size, counts.page_view ?? 0);
  const ratio = (subset: Set<string>) => (viewCount ? subset.size / viewCount : 0);

  const frustratedViews = new Set<string>();
  const hotspots = new Map<string, UXSummary['frustration'][number]>();
  for (const event of events) {
    if (event.type !== 'rage_click' && event.type !== 'dead_click') continue;
    frustratedViews.add(event.view);
    const key = `${event.page}\u0000${event.element}`;
    const spot = hotspots.get(key) ?? { element: event.element, page: event.page, rageClicks: 0, deadClicks: 0, total: 0 };
    if (event.type === 'rage_click') spot.rageClicks++;
    else spot.deadClicks++;
    spot.total++;
    hotspots.set(key, spot);
  }

  const fieldErrors = new Map<string, UXSummary['formErrors'][number]>();
  for (const event of of(events, 'form_error')) {
    const key = `${event.form}\u0000${event.field}\u0000${event.validity}`;
    const row = fieldErrors.get(key) ?? { form: event.form, field: event.field, validity: event.validity, count: 0 };
    row.count++;
    fieldErrors.set(key, row);
  }

  const forms = new Map<string, UXSummary['forms'][number] & { lastFields: Map<string, number> }>();
  const formRow = (form: string) => {
    let row = forms.get(form);
    if (!row) {
      row = { form, submits: 0, successes: 0, abandons: 0, errors: 0, topAbandonField: null, lastFields: new Map() };
      forms.set(form, row);
    }
    return row;
  };
  for (const event of of(events, 'form_submit')) {
    const row = formRow(event.form);
    row.submits++;
    if (event.success) row.successes++;
  }
  for (const event of of(events, 'form_error')) formRow(event.form).errors++;
  for (const event of of(events, 'form_abandon')) {
    const row = formRow(event.form);
    row.abandons++;
    if (event.lastField) row.lastFields.set(event.lastField, (row.lastFields.get(event.lastField) ?? 0) + 1);
  }

  const endpoints = new Map<string, UXSummary['requests'][number]>();
  for (const event of events) {
    if (event.type !== 'request_error' && event.type !== 'request_slow') continue;
    const key = `${event.method} ${event.url}`;
    const row = endpoints.get(key) ?? { endpoint: key, errors: 0, slow: 0, worstMs: 0 };
    if (event.type === 'request_error') row.errors++;
    else row.slow++;
    row.worstMs = Math.max(row.worstMs, event.durationMs);
    endpoints.set(key, row);
  }

  const summaries = of(events, 'page_summary');
  const dismissedViews = new Set(of(events, 'pal_dismiss').map((event) => event.view));

  return {
    views: viewCount,
    counts,
    frustrationRate: ratio(frustratedViews),
    dismissRate: ratio(dismissedViews),
    avgWaitMs: summaries.length ? Math.round(summaries.reduce((sum, s) => sum + s.waitMs, 0) / summaries.length) : 0,
    offlineMs: of(events, 'offline').reduce((sum, event) => sum + event.durationMs, 0),
    frustration: byTotal(hotspots, (spot) => spot.total),
    formErrors: byTotal(fieldErrors, (row) => row.count),
    forms: byTotal(forms, (row) => row.abandons * 2 + row.errors).map(({ lastFields, ...row }) => ({
      ...row,
      topAbandonField: [...lastFields].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    })),
    requests: byTotal(endpoints, (row) => row.errors * 2 + row.slow),
  };
}
