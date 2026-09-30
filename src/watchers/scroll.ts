import type { ScrollOptions, Unwatch } from '../types';
import { isElement, type WatchContext } from './context';

/** Speed is averaged over this window, so it doesn't depend on how often scroll events fire. */
const WINDOW_MS = 300;
/** Movements needed inside the window, so a single jump (e.g. an anchor link) doesn't count. */
const MIN_MOVES = 2;

interface Track {
  x: number;
  y: number;
  moves: { t: number; distance: number }[];
}

/** Dizzy while the page (or any scroll container) is scrolled fast. */
export function watchScroll(ctx: WatchContext, { threshold = 2 }: ScrollOptions = {}): Unwatch {
  const { win, doc, engine } = ctx;
  const tracks = new WeakMap<object, Track>();
  tracks.set(doc, { x: win.scrollX, y: win.scrollY, moves: [] });

  const onScroll = (event: Event) => {
    const el = isElement(event.target) ? event.target : null;
    const key = el ?? doc;
    const x = el ? el.scrollLeft : win.scrollX;
    const y = el ? el.scrollTop : win.scrollY;
    const t = Date.now();

    const track = tracks.get(key);
    if (!track) {
      tracks.set(key, { x, y, moves: [] }); // first sighting of this container: no baseline yet
      return;
    }

    track.moves.push({ t, distance: Math.abs(x - track.x) + Math.abs(y - track.y) });
    track.x = x;
    track.y = y;
    while (track.moves[0]!.t <= t - WINDOW_MS) track.moves.shift();

    const distance = track.moves.reduce((sum, move) => sum + move.distance, 0);
    if (track.moves.length >= MIN_MOVES && distance >= threshold * WINDOW_MS) {
      engine.set('scroll', 'dizzy', ctx.durations.dizzy);
    }
  };

  // Capture on document also sees scroll events from nested containers (they don't bubble).
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => {
    doc.removeEventListener('scroll', onScroll, { capture: true });
    engine.clear('scroll');
  };
}
