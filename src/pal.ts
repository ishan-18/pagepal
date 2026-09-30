import { blob, cat, ghost } from './characters';
import { PalCore } from './core';
import type {
  BuiltInCharacter,
  CharacterDefinition,
  FormTarget,
  PalOptions,
  Unwatch,
  WatchFormOptions,
  WatchRequestsOptions,
  Watcher,
} from './types';
import {
  avoidOverlaps,
  copy,
  darkMode,
  deadClicks,
  forms,
  idle,
  network,
  pageErrors,
  password,
  rageClicks,
  requests,
  scroll,
  welcomeBack,
} from './watchers/index';

const CHARACTERS: Record<BuiltInCharacter, CharacterDefinition> = { blob, cat, ghost };

/** `false` → disabled, `true` → defaults, object → those options, omitted → per `enabledByDefault`. */
const optionsOf = <T extends object>(value: boolean | T | undefined, enabledByDefault = true): T | null => {
  if (value === undefined) return enabledByDefault ? ({} as T) : null;
  if (value === false) return null;
  return value === true ? ({} as T) : value;
};

/** The built-in watchers selected by `createPal()` options, in install order. */
function watchersFor(options: PalOptions): Watcher[] {
  const list: Watcher[] = [];
  const add = <T extends object>(value: boolean | T | undefined, make: (o: T) => Watcher, byDefault = true) => {
    const resolved = optionsOf(value, byDefault);
    if (resolved) list.push(make(resolved));
  };
  add(options.scroll, scroll);
  add(options.network, network);
  add(options.darkMode, darkMode);
  add(options.idle, idle);
  add(options.password, password);
  add(options.frustration, rageClicks);
  add(options.deadClicks, deadClicks);
  add(options.avoid, avoidOverlaps);
  add(options.copy, copy);
  add(options.welcomeBack, welcomeBack);
  add(options.errors, pageErrors, false);
  if (options.watch) for (const target of [options.watch].flat()) list.push(forms(target));
  add(options.requests, requests, false);
  return list;
}

/** The pal with every built-in watcher available and switched on by options. */
export class Pal extends PalCore {
  constructor(options: PalOptions = {}) {
    const { character, plugins = [], ...rest } = options;
    super({
      ...rest,
      character: typeof character === 'string' ? CHARACTERS[character] : character,
      // Plugins first so they see events from watchers starting up (e.g. already offline).
      plugins: [...plugins, ...watchersFor(options)],
    });
  }

  /**
   * Watch a form (or any container of forms) by selector or element.
   * Winces on validation errors, cheers on successful submit.
   */
  watch(target: FormTarget, options?: WatchFormOptions): Unwatch {
    return this.use(forms(target, options));
  }

  /** Look like it's waiting while `fetch` and `XMLHttpRequest` requests are in flight. */
  watchRequests(options?: WatchRequestsOptions): Unwatch {
    return this.use(requests(options));
  }

  /** Like `watchRequests()`, for `fetch` only. */
  watchFetch(options?: WatchRequestsOptions): Unwatch {
    return this.use(requests({ ...options, kinds: ['fetch'] }));
  }

  /** Like `watchRequests()`, for `XMLHttpRequest` only. */
  watchXHR(options?: WatchRequestsOptions): Unwatch {
    return this.use(requests({ ...options, kinds: ['xhr'] }));
  }
}

/** Create a pal and put it on the page. */
export function createPal(options?: PalOptions): Pal {
  return new Pal(options);
}
