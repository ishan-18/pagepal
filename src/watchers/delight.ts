import type { Unwatch, WelcomeBackOptions } from '../types';
import type { WatchContext } from './context';

/** Wink when the user copies something. */
export function watchCopy(ctx: WatchContext): Unwatch {
  const { doc, engine, durations } = ctx;
  const onCopy = () => engine.set('copy', 'wink', durations.wink);
  doc.addEventListener('copy', onCopy);
  return () => {
    doc.removeEventListener('copy', onCopy);
    engine.clear('copy');
  };
}

/** Cheer when the user returns to the tab after being away for a while. */
export function watchWelcomeBack(ctx: WatchContext, { after = 30_000 }: WelcomeBackOptions = {}): Unwatch {
  const { doc, engine, durations } = ctx;
  let hiddenAt: number | null = doc.visibilityState === 'hidden' ? Date.now() : null;

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt !== null) {
      if (Date.now() - hiddenAt >= after) engine.set('welcome', 'cheer', durations.cheer);
      hiddenAt = null;
    }
  };

  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    engine.clear('welcome');
  };
}
