import type { Unwatch } from '../types';
import type { WatchContext } from './context';

/** Sad while offline, a quick cheer when the connection comes back. */
export function watchNetwork(ctx: WatchContext): Unwatch {
  const { win, engine, durations } = ctx;
  let offlineSince: number | null = null;

  const update = () => {
    if (win.navigator.onLine === false) {
      if (offlineSince !== null) return;
      offlineSince = Date.now();
      engine.set('network', 'sad');
      ctx.emit('connection', { online: false });
    } else {
      engine.clear('network');
      if (offlineSince === null) return;
      engine.set('network-back', 'cheer', durations.cheer);
      ctx.emit('connection', { online: true, offlineMs: Date.now() - offlineSince });
      offlineSince = null;
    }
  };

  update();
  win.addEventListener('online', update);
  win.addEventListener('offline', update);
  return () => {
    win.removeEventListener('online', update);
    win.removeEventListener('offline', update);
    engine.clear('network');
    engine.clear('network-back');
  };
}
