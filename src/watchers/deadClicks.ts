import type { DeadClickOptions, Unwatch } from '../types';
import { isElement, type WatchContext } from './context';

/** Things people expect to do something when clicked. */
const CLICKABLE =
  'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], ' +
  'input[type="submit"], input[type="button"], input[type="reset"], input[type="image"], summary, [onclick]';

/** Respond natively without changing the DOM (focus, pickers, new tabs, downloads...). */
const NATIVE_RESPONDERS =
  'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, option, label, ' +
  'video, audio, iframe, [contenteditable]:not([contenteditable="false"]), a[target="_blank"], a[download]';

const NAVIGATION_EVENTS = ['hashchange', 'popstate', 'pagehide', 'beforeunload'];

/**
 * Confused when a clickable-looking element doesn't respond: no DOM change,
 * navigation, scroll, focus change or request within `timeout`.
 * Emits `frustration` with `kind: 'dead-click'`.
 */
export function watchDeadClicks(ctx: WatchContext, { timeout = 1000, ignore }: DeadClickOptions = {}): Unwatch {
  const { win, doc, engine, durations, host } = ctx;
  const ignoreSelector = `[data-pagepal-ignore]${ignore ? `, ${ignore}` : ''}`;
  const pending = new Map<Element, () => void>();
  const suppressed = new WeakSet<Element>();

  const isOwn = (node: Node) => node === host || host.contains(node);

  const clickableFor = (el: Element): Element | null => {
    const explicit = el.closest(CLICKABLE);
    if (explicit) return explicit;
    // Styled to look clickable. `cursor` is inherited, so report the outermost element
    // that has it (the card), not the span inside it that merely inherits it.
    const pointer = (node: Element | null): node is Element =>
      !!node && node !== doc.body && node !== doc.documentElement && win.getComputedStyle(node).cursor === 'pointer';
    if (!pointer(el)) return null;
    let owner = el;
    for (let depth = 0; depth < 8 && pointer(owner.parentElement); depth++) owner = owner.parentElement;
    return owner;
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!isElement(target) || isOwn(target)) return;
    if (target.closest(ignoreSelector) || target.closest(NATIVE_RESPONDERS)) return;
    if (win.getSelection?.()?.toString()) return; // selecting text, not clicking
    const clickable = clickableFor(target);
    if (!clickable || pending.has(clickable)) return;

    let responded = false;
    const respond = () => (responded = true);
    const observer = new win.MutationObserver((records) => {
      if (records.some((record) => !isOwn(record.target))) respond();
    });
    observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    const unsubscribe = ctx.activity.subscribe(respond);
    // Scroll events are delivered on the next frame, so one arriving right after the click belongs to a scroll that was already happening.
    const clickedAt = Date.now();
    const onScroll = () => {
      if (Date.now() - clickedAt > 50) respond();
    };
    NAVIGATION_EVENTS.forEach((type) => win.addEventListener(type, respond));
    doc.addEventListener('scroll', onScroll, true);
    doc.addEventListener('focusin', respond, true);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
      unsubscribe();
      NAVIGATION_EVENTS.forEach((type) => win.removeEventListener(type, respond));
      doc.removeEventListener('scroll', onScroll, true);
      doc.removeEventListener('focusin', respond, true);
      pending.delete(clickable);
    };

    const timer = setTimeout(() => {
      cleanup();
      if (responded || suppressed.has(clickable)) {
        suppressed.delete(clickable);
        return;
      }
      engine.set('dead-click', 'confused', durations.confused);
      ctx.emit('frustration', {
        kind: 'dead-click',
        target: clickable,
        clicks: 1,
        x: event.clientX,
        y: event.clientY,
      });
    }, timeout);
    pending.set(clickable, cleanup);
  };

  // A rage click already reports the same element; don't double count.
  const offRage = ctx.on('frustration', (detail) => {
    if (detail.kind !== 'rage-click') return;
    for (const el of pending.keys()) {
      if (el === detail.target || el.contains(detail.target) || detail.target.contains(el)) suppressed.add(el);
    }
  });

  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('click', onClick, true);
    offRage();
    [...pending.values()].forEach((cleanup) => cleanup());
    engine.clear('dead-click');
  };
}
