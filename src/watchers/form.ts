import type { FormTarget, Unwatch, WatchFormOptions } from '../types';
import { isElement, type WatchContext } from './context';

type Field = Element & {
  validity?: ValidityState;
  willValidate?: boolean;
  required?: boolean;
  value?: string;
  checked?: boolean;
  type?: string;
  form?: HTMLFormElement | null;
};

const VALIDITY_FLAGS = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooShort',
  'tooLong',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'badInput',
  'customError',
] as const;

let nextId = 0;

const isInvalid = (el: Element) => {
  const field = el as Field;
  return (field.willValidate && field.validity?.valid === false) || el.getAttribute('aria-invalid') === 'true';
};

const validityOf = (el: Element): string | null => {
  const validity = (el as Field).validity;
  return (validity && VALIDITY_FLAGS.find((flag) => validity[flag])) || null;
};

const formOf = (el: Element): HTMLFormElement | null => (el as Field).form ?? el.closest('form');

const isRequired = (el: Element) => (el as Field).required === true || el.getAttribute('aria-required') === 'true';

/** Required and satisfied: native validity for `required`, a value for `aria-required`. */
const isDone = (el: Element) => {
  if (isInvalid(el)) return false;
  const field = el as Field;
  if (field.required) return true;
  if (field.type === 'checkbox' || field.type === 'radio') return !!field.checked;
  return typeof field.value === 'string' ? field.value.trim() !== '' : true;
};

/** Share of required fields that are done, or `null` when the form has none. */
export function formProgress(form: HTMLFormElement): number | null {
  const required = Array.from(form.elements).filter(isRequired);
  return required.length ? required.filter(isDone).length / required.length : null;
}

/**
 * Wince on validation errors (and look at the offending field), cheer on
 * successful submit, and get happier as required fields fill in.
 *
 * Uses event delegation on the document, so a selector target also covers forms
 * rendered after `watch()` is called (SPAs). Validation errors are detected from
 * native `invalid` events and from `aria-invalid="true"`.
 */
export function watchForm(
  ctx: WatchContext,
  target: FormTarget,
  { cheer = true, wince = true, progress = true }: WatchFormOptions = {},
): Unwatch {
  const { doc, engine, durations } = ctx;
  const key = `form#${nextId++}`;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const lastProgress = new WeakMap<HTMLFormElement, number | null>();
  let lastError = 0;

  const matches = (el: Element) =>
    typeof target === 'string' ? el.closest(target) !== null : target.contains(el);

  const inScope = (node: unknown): node is Element => {
    if (!isElement(node)) return false;
    const owner = (node as Field).form;
    return matches(node) || (isElement(owner) && matches(owner));
  };

  const flagError = (field: Element, source: 'invalid' | 'aria-invalid') => {
    ctx.emit('formError', { form: formOf(field), field, source, validity: validityOf(field) });
    if (!wince) return;
    engine.set(key, 'wince', durations.wince);
    // A failed submit fires `invalid` for every bad field in document order; look at the first.
    const now = Date.now();
    if (now - lastError > 100) ctx.lookAt(field);
    lastError = now;
  };

  const onInvalid = (event: Event) => {
    if (inScope(event.target)) flagError(event.target, 'invalid');
  };

  const onSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (!inScope(form)) return;
    // Wait a tick: JS validators typically flag fields (aria-invalid) inside their submit handler.
    const timer = setTimeout(() => {
      timers.delete(timer);
      const firstInvalid = Array.from(form.elements).find(isInvalid);
      ctx.emit('formSubmit', { form, success: !firstInvalid });
      if (firstInvalid) {
        flagError(firstInvalid, firstInvalid.getAttribute('aria-invalid') === 'true' ? 'aria-invalid' : 'invalid');
      } else {
        if (cheer) engine.set(key, 'cheer', durations.cheer);
        if (progress) ctx.view.setJoy(0);
      }
    }, 0);
    timers.add(timer);
  };

  const onInput = (event: Event) => {
    const field = event.target;
    if (!inScope(field)) return;
    const form = formOf(field);
    if (!form) return;
    const value = formProgress(form);
    ctx.emit('formProgress', { form, field, progress: value });
    if (!progress || value === null) return;
    ctx.view.setJoy(value);
    if (value === 1 && lastProgress.get(form) !== 1) engine.set(`${key}:ready`, 'wink', durations.wink);
    lastProgress.set(form, value);
  };

  const observer = new ctx.win.MutationObserver((records) => {
    for (const record of records) {
      const el = record.target as Element;
      if (record.oldValue !== 'true' && el.getAttribute('aria-invalid') === 'true' && inScope(el)) {
        flagError(el, 'aria-invalid');
        return;
      }
    }
  });

  doc.addEventListener('invalid', onInvalid, true); // `invalid` doesn't bubble
  doc.addEventListener('submit', onSubmit, true);
  doc.addEventListener('input', onInput, true);
  doc.addEventListener('change', onInput, true);
  observer.observe(typeof target === 'string' ? doc.documentElement : target, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-invalid'],
    attributeOldValue: true,
  });

  return () => {
    doc.removeEventListener('invalid', onInvalid, true);
    doc.removeEventListener('submit', onSubmit, true);
    doc.removeEventListener('input', onInput, true);
    doc.removeEventListener('change', onInput, true);
    observer.disconnect();
    timers.forEach(clearTimeout);
    engine.clear(key);
    engine.clear(`${key}:ready`);
    if (progress) ctx.view.setJoy(0);
  };
}
