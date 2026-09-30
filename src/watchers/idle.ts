import type { IdleOptions, Unwatch } from '../types';
import type { WatchContext } from './context';

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'visibilitychange'];

/** Dozes off after `timeout` ms without user activity; wakes on the next one. */
export function watchIdle(ctx: WatchContext, { timeout = 30_000 }: IdleOptions = {}): Unwatch {
  const { doc, engine } = ctx;
  let lastActivity = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Activity only records a timestamp; the timer re-arms itself for the remainder.
  // That keeps high-frequency events like pointermove from thrashing timers.
  const check = () => {
    const elapsed = Date.now() - lastActivity;
    if (elapsed >= timeout) {
      timer = undefined;
      engine.set('idle', 'dozing');
    } else {
      timer = setTimeout(check, timeout - elapsed);
    }
  };

  const onActivity = () => {
    lastActivity = Date.now();
    if (timer === undefined) {
      engine.clear('idle');
      timer = setTimeout(check, timeout);
    }
  };

  const listenerOptions = { capture: true, passive: true };
  ACTIVITY_EVENTS.forEach((type) => doc.addEventListener(type, onActivity, listenerOptions));
  timer = setTimeout(check, timeout);

  return () => {
    ACTIVITY_EVENTS.forEach((type) => doc.removeEventListener(type, onActivity, listenerOptions));
    clearTimeout(timer);
    engine.clear('idle');
  };
}
