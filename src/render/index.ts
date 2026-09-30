import type { Mood, Position } from '../types';
import { buildSvg, isImages, partsFor, type RenderableCharacter } from './characters';
import { MOODS } from './face';
import { buildStyles } from './styles';

export interface ViewOptions {
  container: HTMLElement;
  position: Position;
  size: number;
  offset: number;
  /** Any CSS color value, including `var(...)` fallbacks. */
  color: string;
  zIndex: number;
  character: RenderableCharacter;
  interactive: boolean;
  /** Focusable, labelled dismiss button (and the host is no longer aria-hidden). */
  keyboard: boolean;
  dismissLabel: string;
}

export interface View {
  readonly host: HTMLElement;
  readonly closeButton: HTMLButtonElement;
  readonly options: Readonly<ViewOptions>;
  setMood(mood: Mood): void;
  say(text: string, duration: number): void;
  /** Turn toward a direction. `x`/`y` in [-1, 1]; `0, 0` looks straight ahead. */
  look(x: number, y: number): void;
  setHidden(hidden: boolean): void;
  /** Move to viewport coordinates (top-left corner), switching from corner anchoring. */
  placeAt(left: number, top: number): void;
  /** Whether the user dragged it somewhere (then automatic repositioning stays out of the way). */
  isPlaced(): boolean;
  /** Temporarily shift away from its spot (px), e.g. to clear a chat widget. */
  setDodge(x: number, y: number): void;
  getDodge(): { x: number; y: number };
  /** Progress ring, 0..1, or `null` to hide it. */
  setProgress(value: number | null): void;
  /** Form progress, 0..1: warmer cheeks. */
  setJoy(value: number): void;
  destroy(): void;
}

export const TAG = 'pagepal-mascot';

const CLOSE_ICON =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createView(doc: Document, options: ViewOptions): View {
  const host = doc.createElement(TAG);
  const { character } = options;
  let placed = false;
  let dodge = { x: 0, y: 0 };

  host.dataset.corner = options.position;
  host.dataset.mood = 'neutral';
  host.dataset.character = isImages(character) ? 'custom' : (character.name ?? 'custom');
  if (!isImages(character) && character.motion === 'hover') host.dataset.motion = 'hover';
  if (options.interactive) host.dataset.interactive = '';
  host.style.setProperty('--pp-size', `${options.size}px`);
  host.style.setProperty('--pp-color', options.color);
  if (options.position !== 'inline') {
    const [vertical, horizontal] = options.position.split('-') as ['top' | 'bottom', 'left' | 'right'];
    host.style.setProperty(vertical, `${options.offset}px`);
    host.style.setProperty(horizontal, `${options.offset}px`);
    host.style.zIndex = String(options.zIndex);
  }

  const keyboard = options.interactive && options.keyboard;
  // Decorative unless it offers a keyboard control: the page's own UI should convey errors to assistive tech.
  if (!keyboard) host.setAttribute('aria-hidden', 'true');

  const root = host.attachShadow({ mode: 'open' });
  const closeAttrs = keyboard
    ? `aria-label="${options.dismissLabel.replace(/[&"<>]/g, '')}"`
    : 'tabindex="-1" aria-hidden="true"';
  root.innerHTML =
    `<style>${buildStyles(partsFor(character))}</style>${buildSvg(character)}` +
    `<div class="bubble" part="bubble" aria-hidden="true"></div>` +
    `<button class="close" part="close" type="button" title="Hide" ${closeAttrs}>${CLOSE_ICON}</button>`;

  if (isImages(character)) {
    for (const mood of MOODS) {
      const url = character.images[mood];
      if (url) root.querySelector(`.img-${mood}`)?.setAttribute('href', url);
    }
  }

  const bubble = root.querySelector<HTMLElement>('.bubble')!;
  const closeButton = root.querySelector<HTMLButtonElement>('.close')!;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

  options.container.appendChild(host);

  return {
    host,
    closeButton,
    options,
    setMood(mood) {
      host.dataset.mood = mood;
    },
    say(text, duration) {
      clearTimeout(bubbleTimer);
      bubble.textContent = text;
      bubble.classList.add('show');
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
    },
    look(x, y) {
      host.style.setProperty('--pp-gx', `${(x * 5).toFixed(2)}px`);
      host.style.setProperty('--pp-gy', `${(y * 4).toFixed(2)}px`);
      host.style.setProperty('--pp-tilt', `${(x * 8).toFixed(2)}deg`);
    },
    setHidden(hidden) {
      host.hidden = hidden;
    },
    placeAt(left, top) {
      placed = true;
      this.setDodge(0, 0);
      host.style.left = `${Math.round(left)}px`;
      host.style.top = `${Math.round(top)}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    },
    isPlaced: () => placed,
    setDodge(x, y) {
      dodge = { x: Math.round(x), y: Math.round(y) };
      host.style.translate = dodge.x || dodge.y ? `${dodge.x}px ${dodge.y}px` : '';
    },
    getDodge: () => dodge,
    setProgress(value) {
      if (value === null) {
        delete host.dataset.progress;
        host.style.removeProperty('--pp-progress');
      } else {
        host.dataset.progress = '';
        host.style.setProperty('--pp-progress', (clamp01(value) * 100).toFixed(1));
      }
    },
    setJoy(value) {
      host.style.setProperty('--pp-joy', clamp01(value).toFixed(2));
    },
    destroy() {
      clearTimeout(bubbleTimer);
      host.remove();
    },
  };
}
