import type { Unwatch } from '../types';
import { isElement, type WatchContext } from './context';

const isPasswordField = (el: Element | null) =>
  !!el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password';

/**
 * Covers its eyes while a password field has focus. "Show password" toggles
 * (which switch the input's type to text) uncover them.
 */
export function watchPassword(ctx: WatchContext): Unwatch {
  const { win, doc, engine } = ctx;
  let focused: Element | null = null;

  const update = () =>
    isPasswordField(focused) ? engine.set('password', 'shy') : engine.clear('password');

  const typeObserver = new win.MutationObserver(update);

  const focus = (el: Element | null) => {
    focused = el;
    typeObserver.disconnect();
    if (el?.tagName === 'INPUT') typeObserver.observe(el, { attributes: true, attributeFilter: ['type'] });
    update();
  };

  const onFocusIn = (event: FocusEvent) => focus(isElement(event.target) ? event.target : null);
  const onFocusOut = () => focus(null);

  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  if (doc.activeElement && doc.activeElement !== doc.body) focus(doc.activeElement);

  return () => {
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
    typeObserver.disconnect();
    engine.clear('password');
  };
}
