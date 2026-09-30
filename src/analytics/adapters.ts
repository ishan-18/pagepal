import type { Sink, UXEvent } from './types';

type Params = Record<string, string | number | boolean>;

/**
 * Flat, primitive-only properties (what GA4/Plausible accept). Drops the
 * per-view id (those tools have their own session model) and flattens counts.
 */
function flatten(event: UXEvent): Params {
  const params: Params = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === 'type' || key === 'view' || value === null || value === undefined) continue;
    if (typeof value === 'object') {
      for (const [inner, count] of Object.entries(value)) params[`${key}_${inner}`] = count as number;
    } else {
      params[key] = value as string | number | boolean;
    }
  }
  return params;
}

/** These tools track page views themselves. */
const forwarded = (events: UXEvent[]) => events.filter((event) => event.type !== 'page_view');
const eventName = (event: UXEvent) => `pagepal_${event.type}`;

/** Google Analytics 4: `toGA4(gtag)`. */
export const toGA4 =
  (gtag: (command: 'event', name: string, params: Params) => void): Sink =>
  (events) =>
    forwarded(events).forEach((event) => gtag('event', eventName(event), flatten(event)));

/** PostHog: `toPostHog(posthog)`. */
export const toPostHog =
  (posthog: { capture(name: string, properties: Record<string, unknown>): unknown }): Sink =>
  (events) =>
    forwarded(events).forEach((event) => posthog.capture(eventName(event), flatten(event)));

/** Segment / RudderStack / any `analytics.track` API: `toSegment(analytics)`. */
export const toSegment =
  (analytics: { track(name: string, properties: Record<string, unknown>): unknown }): Sink =>
  (events) =>
    forwarded(events).forEach((event) => analytics.track(eventName(event), flatten(event)));

/** Plausible custom events: `toPlausible(plausible)`. */
export const toPlausible =
  (plausible: (name: string, options: { props: Params }) => void): Sink =>
  (events) =>
    forwarded(events).forEach((event) => plausible(eventName(event), { props: flatten(event) }));
