import type { AvoidOptions, Unwatch } from '../types';
import type { WatchContext } from './context';

const GAP = 12;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const union = (a: Box | null, b: Box): Box =>
  a
    ? { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }
    : b;

/**
 * Keeps the pal clear of other things pinned to its corner (chat widgets,
 * cookie banners, sticky footers) by sliding up/down past them or, if there's
 * no room, to the other side. Also slides aside while the focused field is
 * underneath it. A spot the user dragged it to is left alone.
 */
export function watchAvoid(ctx: WatchContext, { selectors = [], focus = true }: AvoidOptions = {}): Unwatch {
  const { win, doc, view, host } = ctx;
  const { position, size, offset } = view.options;
  if (position === 'inline') return () => {};
  const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'right'];

  let focusDodge = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;

  /** Where the pal sits in its corner, before any dodging. */
  const home = (): Box => {
    const left = horizontal === 'left' ? offset : win.innerWidth - offset - size;
    const top = vertical === 'top' ? offset : win.innerHeight - offset - size;
    return { left, top, right: left + size, bottom: top + size };
  };

  const shift = (box: Box, x: number, y: number): Box => ({
    left: box.left + x,
    right: box.right + x,
    top: box.top + y,
    bottom: box.bottom + y,
  });

  /** Nearest fixed/sticky ancestor (or self), which is what actually occupies the corner. */
  const pinned = (el: Element | null): Element | null => {
    for (let node = el; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      const { position: pos } = win.getComputedStyle(node);
      if (pos === 'fixed' || pos === 'sticky') return node;
    }
    return null;
  };

  /**
   * Tall pinned elements (sidebars, app shells, full-screen layouts) are page chrome the pal
   * floats over like any corner widget, not something to dodge. Only short things (chat
   * bubbles, cookie banners, sticky footers) count as obstacles.
   */
  const isLayout = (el: Element) => el.getBoundingClientRect().height > win.innerHeight * 0.5;

  /** Union of everything pinned that overlaps `box`. */
  const obstacles = (box: Box): Box | null => {
    const found = new Set<Element>();
    if (typeof doc.elementsFromPoint === 'function') {
      const inset = 4;
      const points: [number, number][] = [
        [box.left + inset, box.top + inset],
        [box.right - inset, box.top + inset],
        [box.left + inset, box.bottom - inset],
        [box.right - inset, box.bottom - inset],
        [(box.left + box.right) / 2, (box.top + box.bottom) / 2],
      ];
      for (const [x, y] of points) {
        for (const el of doc.elementsFromPoint(x, y)) {
          if (el === host || host.contains(el)) continue;
          const container = pinned(el);
          if (container && !container.contains(host) && !isLayout(container)) found.add(container);
        }
      }
    }
    for (const selector of selectors) doc.querySelectorAll(selector).forEach((el) => found.add(el));

    let blocked: Box | null = null;
    for (const el of found) {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height && intersects(rect, box)) blocked = union(blocked, rect);
    }
    return blocked;
  };

  const mirrorX = () => (horizontal === 'right' ? -1 : 1) * (win.innerWidth - size - 2 * offset);

  const update = () => {
    scheduled = undefined;
    if (view.isPlaced()) return;
    const start = home();

    if (focusDodge) {
      view.setDodge(mirrorX(), 0);
      return;
    }

    const blocked = obstacles(start);
    if (!blocked) {
      view.setDodge(0, 0);
      return;
    }

    // Slide past the obstacle vertically if that stays on screen...
    const dy = vertical === 'bottom' ? blocked.top - GAP - start.bottom : blocked.bottom + GAP - start.top;
    const slid = shift(start, 0, dy);
    if (slid.top >= 0 && slid.bottom <= win.innerHeight && !obstacles(slid)) {
      view.setDodge(0, dy);
      return;
    }
    // ...otherwise try the other side of the screen.
    const mirrored = shift(start, mirrorX(), 0);
    // No clear spot: staying home beats guessing (a partial slide can land on the header).
    view.setDodge(obstacles(mirrored) ? 0 : mirrorX(), 0);
  };

  const schedule = () => {
    if (scheduled === undefined) scheduled = setTimeout(update, 150);
  };

  const onFocusIn = (event: FocusEvent) => {
    if (!focus || view.isPlaced()) return;
    const target = event.target as Element | null;
    if (!target?.getBoundingClientRect || target === host) return;
    const current = shift(home(), view.getDodge().x, view.getDodge().y);
    const overlapping = intersects(target.getBoundingClientRect(), current);
    if (overlapping !== focusDodge) {
      focusDodge = overlapping;
      update();
    }
  };
  const onFocusOut = () => {
    if (!focusDodge) return;
    focusDodge = false;
    schedule();
  };

  // Widgets tend to be injected late; re-check when the page changes (ignoring the pal's own attributes).
  const observer = new win.MutationObserver((records) => {
    if (records.some((record) => record.target !== host)) schedule();
  });
  observer.observe(doc.body ?? doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'open'],
  });
  win.addEventListener('resize', schedule);
  doc.addEventListener('scroll', schedule, { capture: true, passive: true });
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  schedule();

  return () => {
    clearTimeout(scheduled);
    observer.disconnect();
    win.removeEventListener('resize', schedule);
    doc.removeEventListener('scroll', schedule, { capture: true });
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
    view.setDodge(0, 0);
  };
}
