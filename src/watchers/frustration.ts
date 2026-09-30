import type { FrustrationOptions, Unwatch } from '../types';
import { isElement, type WatchContext } from './context';

/** Concerned on rage clicks (several quick clicks in one spot), plus a `frustration` event. */
export function watchFrustration(
  ctx: WatchContext,
  { clicks = 4, within = 1000, radius = 30 }: FrustrationOptions = {},
): Unwatch {
  const { doc, engine, durations, host } = ctx;
  let recent: { t: number; x: number; y: number }[] = [];

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    // Poking the pal itself is play, not frustration.
    if (!isElement(target) || target === host || host.contains(target)) return;

    const t = Date.now();
    const { clientX: x, clientY: y } = event;
    recent = recent.filter((c) => t - c.t < within && Math.hypot(c.x - x, c.y - y) <= radius);
    recent.push({ t, x, y });

    if (recent.length >= clicks) {
      engine.set('frustration', 'concerned', durations.concerned);
      ctx.emit('frustration', { kind: 'rage-click', target, clicks: recent.length, x, y });
      recent = [];
    }
  };

  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('click', onClick, true);
    engine.clear('frustration');
  };
}
