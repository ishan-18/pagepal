/**
 * Privacy-safe labels for elements and URLs. Never reads input values; masks
 * digits and emails in visible labels; drops query strings and ID-like path
 * segments.
 */

const NAME_ATTRIBUTES = ['data-pagepal-name', 'data-testid', 'data-test', 'data-track', 'data-analytics'];
const LABELLED_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'checkbox', 'switch']);
const LABELLED_TAGS = new Set(['BUTTON', 'A', 'SUMMARY', 'LABEL', 'LEGEND']);
const MAX_TEXT = 40;

/** Replace emails and digits, collapse whitespace, truncate. */
export function maskText(text: string, max = MAX_TEXT): string {
  const masked = text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return masked.length > max ? `${masked.slice(0, max - 1)}…` : masked;
}

/** Generated ids (React `:r1:`, hashes, long numbers) are noise and can be unique per user. */
const isStableId = (id: string) => id.length <= 40 && !/\d{3,}|^:|:$|^[0-9a-f]{8,}$/i.test(id);

/** Visible label for things people click (never form values). */
function labelOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  const input = el as HTMLInputElement;
  if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(input.type)) return input.value;
  const role = el.getAttribute('role');
  if (LABELLED_TAGS.has(el.tagName) || (role && LABELLED_ROLES.has(role))) return el.textContent ?? '';
  return '';
}

/** One path segment that looks like an id, token or personal data. */
const isIdLike = (segment: string) =>
  /^\d+$/.test(segment) ||
  segment.includes('@') ||
  segment.length > 40 ||
  (/^[0-9a-z_-]{8,}$/i.test(segment) && /\d/.test(segment) && /[a-z]/i.test(segment) && !/^[a-z]+(-[a-z]+)*-?\d{1,2}$/i.test(segment));

/** `/users/12345/orders` → `/users/:id/orders`. */
export function sanitizePath(path: string): string {
  return path
    .split('/')
    .map((segment) => (segment && isIdLike(segment) ? ':id' : segment))
    .join('/');
}

/** Same-origin URLs become a sanitized path; others keep their origin. Query and hash are dropped. */
export function sanitizeUrl(url: string, base: string): string {
  try {
    const parsed = new URL(url, base);
    const path = sanitizePath(parsed.pathname);
    return parsed.origin === new URL(base).origin ? path : `${parsed.origin}${path}`;
  } catch {
    return '';
  }
}

/**
 * A short, stable, human-readable descriptor, e.g. `button#pay "Pay $##"` or
 * `input[name="email"]`. Add `data-pagepal-name="..."` to name elements
 * yourself, or `data-pagepal-mask` to keep their text out.
 */
export function describeElement(el: Element, captureText = true): string {
  const tag = el.tagName.toLowerCase();
  let out = tag;
  if (el.id && isStableId(el.id)) out += `#${el.id}`;
  const name = el.getAttribute('name');
  if (name) out += `[name="${name}"]`;
  for (const attribute of NAME_ATTRIBUTES) {
    const value = el.getAttribute(attribute);
    if (value) {
      out += `[${attribute}="${value}"]`;
      break;
    }
  }
  if (tag === 'form' && out === tag) {
    const action = el.getAttribute('action');
    if (action) out += `[action="${sanitizeUrl(action, el.ownerDocument.location?.href ?? 'http://localhost/')}"]`;
  }
  if (out === tag) {
    const classes = [...el.classList].filter((c) => c.length <= 30 && !/\d/.test(c)).slice(0, 2);
    if (classes.length) out += `.${classes.join('.')}`;
  }
  if (captureText && !el.closest('[data-pagepal-mask]')) {
    const text = maskText(labelOf(el));
    if (text) out += ` "${text}"`;
  }
  return out;
}
