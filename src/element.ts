import { analytics } from './analytics/index';
import { createPal, type Pal } from './pal';
import type { BuiltInCharacter, PalOptions, Position } from './types';

/** On/off attributes: present (or any value but "false") enables, `="false"` disables. */
const BOOLEAN_ATTRIBUTES = {
  requests: 'requests',
  errors: 'errors',
  interactive: 'interactive',
  keyboard: 'keyboard',
  remember: 'remember',
  scroll: 'scroll',
  network: 'network',
  'dark-mode': 'darkMode',
  idle: 'idle',
  password: 'password',
  frustration: 'frustration',
  'dead-clicks': 'deadClicks',
  avoid: 'avoid',
  copy: 'copy',
  'welcome-back': 'welcomeBack',
} as const satisfies Record<string, keyof PalOptions>;

const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * `<page-pal watch="form#signup" requests character="cat"></page-pal>`
 *
 * Works in plain HTML and any framework. Changing an attribute recreates the pal.
 * `analytics-endpoint="/api/ux"` turns on analytics; `position="inline"` renders
 * it inside the element.
 */
export class PagePalElement extends Base {
  static observedAttributes = [
    'character',
    'position',
    'size',
    'offset',
    'color',
    'watch',
    'storage-key',
    'analytics-endpoint',
    ...Object.keys(BOOLEAN_ATTRIBUTES),
  ];

  private instance: Pal | null = null;

  /** The underlying `Pal`, e.g. to call `react()` or listen with `on()`. */
  get pal(): Pal | null {
    return this.instance;
  }

  connectedCallback(): void {
    if (!this.style.display) this.style.display = 'contents';
    this.create();
  }

  disconnectedCallback(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  attributeChangedCallback(): void {
    if (!this.instance) return;
    this.instance.destroy();
    this.create();
  }

  private create(): void {
    const text = (name: string) => this.getAttribute(name) ?? undefined;
    const number = (name: string) => {
      const value = this.getAttribute(name);
      return value === null || value === '' || Number.isNaN(Number(value)) ? undefined : Number(value);
    };
    const options: PalOptions = {
      character: text('character') as BuiltInCharacter | undefined,
      position: text('position') as Position | undefined,
      size: number('size'),
      offset: number('offset'),
      color: text('color'),
      watch: text('watch'),
      storageKey: text('storage-key'),
    };
    for (const [attribute, option] of Object.entries(BOOLEAN_ATTRIBUTES)) {
      const value = this.getAttribute(attribute);
      if (value !== null) (options as Record<string, unknown>)[option] = value !== 'false';
    }
    if (options.position === 'inline') options.container = this;
    const endpoint = this.getAttribute('analytics-endpoint');
    if (endpoint) options.plugins = [analytics({ endpoint })];
    this.instance = createPal(options);
    this.dispatchEvent(new CustomEvent('pagepal:ready', { detail: this.instance }));
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('page-pal')) {
  customElements.define('page-pal', PagePalElement);
}
