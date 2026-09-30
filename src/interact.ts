import type { View } from './render';
import type { Unwatch } from './types';

/** Movement (px) before a press becomes a drag instead of a poke. */
const DRAG_THRESHOLD = 4;
/** How long the close button stays visible after a tap (touch screens have no hover). */
const CLOSE_REVEAL_MS = 3000;

export interface InteractionOptions {
  size: number;
  draggable: boolean;
  /** Position restored from storage. */
  initialPosition?: { left: number; top: number };
  onPoke(): void;
  onDismiss(): void;
  onMoved(position: { left: number; top: number }): void;
}

export function clampToViewport(win: Window, size: number, left: number, top: number) {
  return {
    left: Math.min(Math.max(0, left), Math.max(0, win.innerWidth - size)),
    top: Math.min(Math.max(0, top), Math.max(0, win.innerHeight - size)),
  };
}

/** Poke (click/tap), drag to move, and a close button. */
export function makeInteractive(win: Window, view: View, options: InteractionOptions): Unwatch {
  const { host, closeButton } = view;
  let press: { x: number; y: number; left: number; top: number } | null = null;
  let dragging = false;
  let position: { left: number; top: number } | null = null;
  if (options.draggable && options.initialPosition) {
    const { left, top } = options.initialPosition;
    position = clampToViewport(win, options.size, left, top);
    view.placeAt(position.left, position.top);
  }
  let revealTimer: ReturnType<typeof setTimeout> | undefined;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.composedPath().includes(closeButton)) return;
    const rect = host.getBoundingClientRect();
    press = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    dragging = false;
    try {
      host.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events have no active pointer; dragging still works without capture.
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!press || !options.draggable) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      host.dataset.dragging = '';
    }
    position = clampToViewport(win, options.size, press.left + dx, press.top + dy);
    view.placeAt(position.left, position.top);
  };

  const endPress = (cancelled: boolean) => {
    if (!press) return;
    const wasDragging = dragging;
    press = null;
    dragging = false;
    delete host.dataset.dragging;
    if (cancelled) return;
    if (wasDragging && position) {
      options.onMoved(position);
    } else if (!wasDragging) {
      options.onPoke();
      host.dataset.showClose = '';
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => delete host.dataset.showClose, CLOSE_REVEAL_MS);
    }
  };
  const onPointerUp = () => endPress(false);
  const onPointerCancel = () => endPress(true);

  const onClose = (event: Event) => {
    event.stopPropagation();
    options.onDismiss();
  };

  // Keep a dragged pal on screen when the window shrinks.
  const onResize = () => {
    if (!position) return;
    position = clampToViewport(win, options.size, position.left, position.top);
    view.placeAt(position.left, position.top);
  };

  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerCancel);
  closeButton.addEventListener('click', onClose);
  win.addEventListener('resize', onResize);

  return () => {
    host.removeEventListener('pointerdown', onPointerDown);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerup', onPointerUp);
    host.removeEventListener('pointercancel', onPointerCancel);
    closeButton.removeEventListener('click', onClose);
    win.removeEventListener('resize', onResize);
    clearTimeout(revealTimer);
  };
}
