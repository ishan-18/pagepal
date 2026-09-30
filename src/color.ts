/** Common accent-color custom properties, checked by `color: 'auto'`. */
const ACCENT_VARS = ['--accent', '--color-accent', '--accent-color', '--primary', '--color-primary', '--brand', '--brand-color'];

/** Parse `#rgb`, `#rrggbb(aa)` and `rgb()/rgba()` into 0..255 channels. */
export function parseColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** Saturated and mid-light enough to be a body color (not white, black or grey). */
export function isColorful(value: string): boolean {
  const rgb = parseColor(value);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (lightness > 0.5 ? 2 - max - min : max + min);
  return saturation >= 0.3 && lightness >= 0.25 && lightness <= 0.8;
}

/**
 * The body color, as a CSS value. An explicit color wins; otherwise the page's
 * `--pagepal-color` variable (live, so it can follow the page's theme), then
 * — for `'auto'` — the page's theme color or accent variable, then `fallback`.
 */
export function resolveColor(doc: Document, win: Window, option: string | undefined, fallback: string): string {
  if (option && option !== 'auto') return option;
  let base = fallback;
  if (option === 'auto') {
    const rootStyle = win.getComputedStyle(doc.documentElement);
    const candidates = [
      doc.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '',
      ...ACCENT_VARS.map((name) => rootStyle.getPropertyValue(name).trim()),
    ];
    base = candidates.find((candidate) => candidate && isColorful(candidate)) ?? fallback;
  }
  return `var(--pagepal-color, ${base})`;
}
