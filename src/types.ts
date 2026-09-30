import type { WatchContext } from './watchers/context';

export type Mood =
  | 'neutral'
  | 'dizzy'
  | 'wince'
  | 'cheer'
  | 'waiting'
  | 'sad'
  | 'sleepy'
  | 'dozing'
  | 'shy'
  | 'concerned'
  | 'confused'
  | 'wink';

/** Moods that are usually short reactions rather than lasting states. */
export type TransientMood = 'cheer' | 'wince' | 'dizzy' | 'wink' | 'concerned' | 'confused';

/** `'inline'` renders in normal document flow inside `container` instead of fixed to a corner. */
export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';

export type BuiltInCharacter = 'blob' | 'cat' | 'ghost';

/** Your own artwork: one image URL per mood. Moods without an image fall back to `neutral`. */
export interface CustomCharacter {
  images: Partial<Record<Mood, string>> & { neutral: string };
}

/**
 * An SVG character drawn in a 100×100 viewBox. pagepal draws the face (eyes
 * around y=54, mouth around y=70, cheeks at x=26/74) and effects on top, so
 * every mood works. Markup is trusted: don't build it from user input.
 */
export interface CharacterDefinition {
  name?: string;
  /** Default body color. */
  color: string;
  /** Path data for the body outline (filled with the body color). */
  body: string;
  /** SVG markup drawn behind the body (ears, tails...). Use `class="fur"` for body-colored shapes. */
  back?: string;
  /** SVG markup drawn over the body, under the face (highlights, whiskers...). */
  front?: string;
  /** Idle motion. Default `'breathe'`. */
  motion?: 'breathe' | 'hover';
}

export type Character = BuiltInCharacter | CharacterDefinition | CustomCharacter;

/** Something that stops watching when called. */
export type Unwatch = () => void;

/** A form (or container of forms), by selector or element. */
export type FormTarget = string | Element;

export interface ScrollOptions {
  /** Average scroll speed over the last 300ms, in px per ms, that counts as "fast". Default `2` (600px in 300ms). */
  threshold?: number;
}

export interface IdleOptions {
  /** Milliseconds without user activity before the pal dozes off. Default `30000`. */
  timeout?: number;
}

export interface DarkModeOptions {
  /** Custom dark-mode detector. Defaults to checking common theme attributes/classes, then `prefers-color-scheme`. */
  detect?: () => boolean;
}

export interface FrustrationOptions {
  /** Clicks needed to count as a rage click. Default `4` (3 would catch triple-click text selection). */
  clicks?: number;
  /** ...within this many ms. Default `1000`. */
  within?: number;
  /** ...within this many px of each other. Default `30`. */
  radius?: number;
}

export interface DeadClickOptions {
  /** How long to wait for the page to respond to a click, in ms. Default `1000`. */
  timeout?: number;
  /** Elements to never report (in addition to `[data-pagepal-ignore]`). */
  ignore?: string;
}

export interface AvoidOptions {
  /** Extra elements to keep clear of, even if they aren't `position: fixed`. */
  selectors?: string[];
  /** Also slide aside when the focused field is underneath the pal. Default `true`. */
  focus?: boolean;
}

export interface WelcomeBackOptions {
  /** Minimum time away (tab hidden), in ms, before the pal greets the user. Default `30000`. */
  after?: number;
}

export interface GazeOptions {
  /** How long the pal keeps looking at something, in ms. Default `2500`. */
  duration?: number;
}

/** Options shared by `createPalCore()` and `createPal()`. */
export interface PalCoreOptions {
  /** Where to mount the pal. Default `document.body`. */
  container?: HTMLElement;
  /** Screen corner, or `'inline'`. Default `'bottom-right'`. */
  position?: Position;
  /** Size in px. Default `72`. */
  size?: number;
  /** Distance from the screen edges in px. Default `20`. */
  offset?: number;
  /**
   * Body color (any CSS color). Without it, a `--pagepal-color` CSS variable on
   * the page wins, then the character's color. `'auto'` also tries the page's
   * `<meta name="theme-color">` and common accent variables.
   */
  color?: string;
  /** CSS z-index. Default `2147483000`. */
  zIndex?: number;
  /** Which character to show. `createPalCore()` only accepts definitions and images (default: blob). */
  character?: CharacterDefinition | CustomCharacter;

  /** Users can poke, drag and dismiss the pal. Default `true`. `false` makes it click-through. */
  interactive?: boolean;
  /** Put the dismiss button in the tab order, with an accessible label. Default `true` when interactive. */
  keyboard?: boolean;
  /** Text for assistive tech. */
  labels?: { dismiss?: string };
  /** Remember dismissal and dragged position in localStorage. Default `true`. */
  remember?: boolean;
  /** localStorage key, if you run several pals. Default `'pagepal'`. */
  storageKey?: string;
  /** Look at the field that has a validation error. Default `true`. */
  gaze?: boolean | GazeOptions;

  /** Plugins and watchers to install (e.g. `analytics()`, `forms('#signup')`). */
  plugins?: (PalPlugin | Watcher)[];

  /** How long short-lived reactions last, in ms. */
  durations?: Partial<Record<TransientMood, number>>;
  /** Override which mood wins when several apply at once (higher wins). */
  priorities?: Partial<Record<Mood, number>>;
}

export interface PalOptions extends Omit<PalCoreOptions, 'character'> {
  /** Which character to show. Default `'blob'`. */
  character?: Character;

  /** Forms to watch right away (same as calling `watch()`). */
  watch?: FormTarget | FormTarget[];
  /** Watch fetch and XMLHttpRequest right away (same as calling `watchRequests()`). */
  requests?: boolean | WatchRequestsOptions;

  /** React to fast scrolling. Default `true`. */
  scroll?: boolean | ScrollOptions;
  /** React to going offline. Default `true`. */
  network?: boolean;
  /** React to dark mode. Default `true`. */
  darkMode?: boolean | DarkModeOptions;
  /** Doze off when the user is idle. Default `true`. */
  idle?: boolean | IdleOptions;
  /** Cover its eyes while a password field is focused. Default `true`. */
  password?: boolean;
  /** Look concerned on rage clicks, and emit a `frustration` event. Default `true`. */
  frustration?: boolean | FrustrationOptions;
  /** Look confused when a clickable-looking element doesn't respond, and emit a `frustration` event. Default `true`. */
  deadClicks?: boolean | DeadClickOptions;
  /** Step aside for chat widgets, cookie banners and focused fields. Default `true`. */
  avoid?: boolean | AvoidOptions;
  /** Wink when the user copies text. Default `true`. */
  copy?: boolean;
  /** Cheer when the user comes back to the tab after a while. Default `true`. */
  welcomeBack?: boolean | WelcomeBackOptions;
  /** Wince on uncaught errors and unhandled promise rejections. Meant for development. Default `false`. */
  errors?: boolean;
}

export interface WatchFormOptions {
  /** Cheer when the form is submitted successfully. Default `true`. */
  cheer?: boolean;
  /** Wince on validation errors (native `invalid` events or `aria-invalid="true"`). Default `true`. */
  wince?: boolean;
  /** Get happier as required fields become valid, and wink when they all are. Default `true`. */
  progress?: boolean;
}

/** What `isError` sees: a fetch `Response`, or the equivalent for an XMLHttpRequest. */
export interface RequestOutcome {
  status: number;
  ok: boolean;
  url: string;
}

export interface WatchRequestsOptions {
  /** Only show "waiting" if a request takes longer than this, in ms. Avoids flicker. Default `150`. */
  delay?: number;
  /** Return `false` to ignore a request. For XMLHttpRequest, `init` only carries `method`. */
  filter?: (input: RequestInfo | URL, init?: RequestInit) => boolean;
  /** Which responses make the pal wince. Network failures always do (aborts never do). Default: status >= 500. */
  isError?: (response: RequestOutcome) => boolean;
  /** Show a progress ring for XHR uploads/downloads of at least this many bytes. `false` disables. Default `100000`. */
  progress?: number | false;
}

/** @deprecated Use `WatchRequestsOptions`. */
export type WatchFetchOptions = WatchRequestsOptions;

export interface FrustrationDetail {
  kind: 'rage-click' | 'dead-click';
  /** The element that was clicked. */
  target: Element;
  clicks: number;
  x: number;
  y: number;
}

export interface FormErrorDetail {
  form: HTMLFormElement | null;
  field: Element;
  /** How the error was detected. */
  source: 'invalid' | 'aria-invalid';
  /** First failing `ValidityState` flag, e.g. `'valueMissing'`, when known. */
  validity: string | null;
}

export interface FormSubmitDetail {
  form: HTMLFormElement;
  success: boolean;
}

export interface FormProgressDetail {
  form: HTMLFormElement;
  field: Element;
  /** Share of required fields that are valid (0..1), or `null` if the form has none. */
  progress: number | null;
}

export interface RequestDetail {
  kind: 'fetch' | 'xhr';
  method: string;
  url: string;
  status: number;
  ok: boolean;
  duration: number;
  /** Counted as an error (network failure or `isError`). */
  failed: boolean;
  aborted: boolean;
}

export interface ConnectionDetail {
  online: boolean;
  /** How long the user was offline, when coming back online. */
  offlineMs?: number;
}

export interface PalEvents {
  /** The visible mood changed. */
  change: (mood: Mood, previous: Mood) => void;
  /** The user seems frustrated (rage clicks, dead clicks). Useful as a UX signal. */
  frustration: (detail: FrustrationDetail) => void;
  /** A watched form reported a validation error. */
  formError: (detail: FormErrorDetail) => void;
  /** A watched form was submitted. */
  formSubmit: (detail: FormSubmitDetail) => void;
  /** The user edited a field in a watched form. */
  formProgress: (detail: FormProgressDetail) => void;
  /** A watched request finished. */
  request: (detail: RequestDetail) => void;
  /** The connection dropped or came back. */
  connection: (detail: ConnectionDetail) => void;
  /** The user clicked or tapped the pal. */
  poke: () => void;
  /** The user dismissed the pal. */
  dismiss: () => void;
}

export type MoodListener = PalEvents['change'];

export interface SignalInfo {
  key: string;
  mood: Mood;
  priority: number;
  /** Epoch ms when it expires, or `null` if it holds until cleared. */
  expiresAt: number | null;
}

/** What a plugin gets to work with. Signal keys are namespaced per plugin. */
export interface PalPluginAPI {
  readonly window: Window & typeof globalThis;
  readonly document: Document;
  readonly durations: Readonly<Record<TransientMood, number>>;
  /** The pal's host element. */
  readonly element: HTMLElement;
  /** The mood currently shown. */
  readonly mood: Mood;
  /** Raise a mood under `key`; with `duration` it expires. Highest priority across all signals wins. */
  signal(key: string, mood: Mood, duration?: number): void;
  clear(key: string): void;
  /** Every active signal, from all sources (for debugging tools). */
  signals(): SignalInfo[];
  /** Show a progress ring (0..1), or remove it with `null`. */
  progress(value: number | null): void;
  lookAt(target: Element | { x: number; y: number } | null, duration?: number): void;
  say(text: string, duration?: number): void;
  on<K extends keyof PalEvents>(event: K, listener: PalEvents[K]): () => void;
}

/** Custom watcher. Return a cleanup function if you add listeners. */
export type PalPlugin = (api: PalPluginAPI) => void | (() => void);

/** Marks built-in watchers from `pagepal/watchers`. */
export const WATCHER: unique symbol = Symbol.for('pagepal.watcher') as never;

/** A built-in watcher, e.g. `forms('#signup')`. Pass it to `use()` or the `plugins` option. */
export interface Watcher {
  readonly [WATCHER]: (ctx: WatchContext) => Unwatch;
}
