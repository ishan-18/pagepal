import {
  WATCHER,
  type AvoidOptions,
  type DarkModeOptions,
  type DeadClickOptions,
  type FormTarget,
  type FrustrationOptions,
  type IdleOptions,
  type ScrollOptions,
  type Unwatch,
  type WatchFormOptions,
  type Watcher,
  type WatchRequestsOptions,
  type WelcomeBackOptions,
} from '../types';
import { watchAvoid } from './avoid';
import type { WatchContext } from './context';
import { watchDarkMode } from './darkMode';
import { watchDeadClicks } from './deadClicks';
import { watchCopy, watchWelcomeBack } from './delight';
import { watchErrors } from './errors';
import { watchForm } from './form';
import { watchFrustration } from './frustration';
import { watchIdle } from './idle';
import { watchNetwork } from './network';
import { watchPassword } from './password';
import { watchRequests, type RequestKind } from './requests';
import { watchScroll } from './scroll';

const watcher = (start: (ctx: WatchContext) => Unwatch): Watcher => ({ [WATCHER]: start });

/** Wince on validation errors, look at the bad field, cheer on submit, warm up as fields fill in. */
export const forms = (target: FormTarget, options?: WatchFormOptions) => watcher((ctx) => watchForm(ctx, target, options));

/** Wait while fetch/XHR requests are in flight; wince when they fail; progress ring for big transfers. */
export const requests = (options?: WatchRequestsOptions & { kinds?: RequestKind[] }) =>
  watcher((ctx) => watchRequests(ctx, options?.kinds ?? ['fetch', 'xhr'], options));

/** Dizzy on fast scrolling. */
export const scroll = (options?: ScrollOptions) => watcher((ctx) => watchScroll(ctx, options));

/** Sad while offline, cheer when back. */
export const network = () => watcher(watchNetwork);

/** Sleepy in dark mode. */
export const darkMode = (options?: DarkModeOptions) => watcher((ctx) => watchDarkMode(ctx, options));

/** Doze off when the user is idle. */
export const idle = (options?: IdleOptions) => watcher((ctx) => watchIdle(ctx, options));

/** Cover its eyes on password fields. */
export const password = () => watcher(watchPassword);

/** Concerned on rage clicks. */
export const rageClicks = (options?: FrustrationOptions) => watcher((ctx) => watchFrustration(ctx, options));

/** Confused when a clickable-looking element doesn't respond. */
export const deadClicks = (options?: DeadClickOptions) => watcher((ctx) => watchDeadClicks(ctx, options));

/** Step aside for chat widgets, banners and focused fields. */
export const avoidOverlaps = (options?: AvoidOptions) => watcher((ctx) => watchAvoid(ctx, options));

/** Wink when the user copies text. */
export const copy = () => watcher(watchCopy);

/** Cheer when the user returns to the tab after a while. */
export const welcomeBack = (options?: WelcomeBackOptions) => watcher((ctx) => watchWelcomeBack(ctx, options));

/** Wince on uncaught errors and unhandled rejections. */
export const pageErrors = () => watcher(watchErrors);

export type { Watcher };
