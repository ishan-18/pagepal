import type { Unwatch } from '../types';
import type { WatchContext } from './context';

/** Wince on uncaught errors and unhandled promise rejections. */
export function watchErrors(ctx: WatchContext): Unwatch {
  const { win, engine, durations } = ctx;
  // Without capture, `error` on window only sees script errors, not failed images/scripts loading.
  const onError = () => engine.set('page-error', 'wince', durations.wince);

  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onError);
  return () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onError);
    engine.clear('page-error');
  };
}
