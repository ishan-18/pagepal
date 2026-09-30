import type { DarkModeOptions, Unwatch } from '../types';
import type { WatchContext } from './context';

const THEME_ATTRIBUTES = ['data-theme', 'data-color-scheme', 'data-bs-theme', 'data-mode'];
const QUERY = '(prefers-color-scheme: dark)';

/**
 * Best-effort dark-mode detection. An explicit page theme (theme attribute,
 * `.dark`/`.light` class, inline `color-scheme`) wins over the OS preference.
 */
export function isDarkMode(doc: Document, win: Window): boolean {
  for (const el of [doc.documentElement, doc.body]) {
    if (!el) continue;
    for (const attr of THEME_ATTRIBUTES) {
      const value = el.getAttribute(attr)?.toLowerCase();
      if (value) return value.includes('dark');
    }
    if (el.classList.contains('dark')) return true;
    if (el.classList.contains('light')) return false;
    const scheme = el.style.colorScheme;
    if (scheme === 'dark' || scheme === 'light') return scheme === 'dark';
  }
  return win.matchMedia?.(QUERY).matches ?? false;
}

/** Sleepy while the page is in dark mode. */
export function watchDarkMode(ctx: WatchContext, { detect }: DarkModeOptions = {}): Unwatch {
  const { win, doc, engine } = ctx;
  const isDark = detect ?? (() => isDarkMode(doc, win));

  const update = () => (isDark() ? engine.set('scheme', 'sleepy') : engine.clear('scheme'));

  const media = win.matchMedia?.(QUERY);
  media?.addEventListener?.('change', update);

  const observer = new win.MutationObserver(update);
  const attributeFilter = ['class', 'style', ...THEME_ATTRIBUTES];
  for (const el of [doc.documentElement, doc.body]) {
    if (el) observer.observe(el, { attributes: true, attributeFilter });
  }

  update();
  return () => {
    media?.removeEventListener?.('change', update);
    observer.disconnect();
    engine.clear('scheme');
  };
}
