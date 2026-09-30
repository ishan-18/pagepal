# Changelog

## 1.0.0

The API is now stable. Everything from 0.2 keeps working; the only behavior changes are listed under "Changed".

### Added
- **Analytics** (`pagepal/analytics`): first-party UX events (rage and dead clicks, form errors, submits and abandonment, failing and slow requests, offline time, mascot dismissals, per-view summary, opt-in JS errors) delivered by `sendBeacon` to your `endpoint` and/or your own `send` sinks. Privacy by default: no input values, masked labels, sanitized URLs, Do Not Track/GPC respected, consent gating, sampling, `redact`. Adapters for GA4, PostHog, Segment and Plausible. `summarize()` for dashboards.
- **Dead clicks**: new `confused` mood and `frustration` events with `kind: 'dead-click'`.
- **Avoids overlaps**: steps aside for fixed/sticky elements in its corner (chat widgets, banners) and for the focused field.
- **Keyboard access**: the dismiss button is labelled and in the tab order (`keyboard`, `labels`).
- **Progress ring** for large XHR uploads/downloads, `pal.progress()`, and `progress()` for plugins.
- **Form progress**: cheeks warm up as required fields become valid; a wink when all are.
- **Rich events**: `formError`, `formSubmit`, `formProgress`, `request`, `connection`.
- **`pagepal/core` + `pagepal/watchers`**: build only what you need; `use()` and `plugins` accept watchers and plugins alike.
- **Character API**: `defineCharacter()` for SVG characters that get every face for free; `pagepal/characters`.
- **Color**: `--pagepal-color` CSS variable and `color: 'auto'`.
- **`<page-pal>` web component** (`pagepal/element`, and in the script-tag build).
- **Debug panel** (`pagepal/debug`): live signals, priorities and recent events.
- Plugin API: `mood`, `element`, `signals()`, `progress()`.
- Demo: analytics dashboard and playground. CI, release (npm provenance), GitHub Pages and baseline workflows. Bundle-size budget (`npm run size`).

### Changed
- With keyboard access (the default when interactive), the host element is no longer `aria-hidden`; the artwork still is. `keyboard: false` restores the old behavior.
- The default color is `var(--pagepal-color, <character color>)`, so pages can recolor it with CSS.
- Network failures are confirmed after 100 ms, so requests cut off by leaving the page aren't reported as errors.

### Fixed
- Overlap avoidance ignores tall pinned panels (docs sidebars, app shells) and stays put when there is no clear spot, instead of sliding into the page header.
- Elements positioned by SVG `transform` attributes (the highlight, the sprout's leaf) were slightly out of place; the wink sparkles jumped to the corner while animating.

## 0.2.0

### Added
- **XMLHttpRequest support.** `watchRequests()` watches fetch and XHR with one shared counter (so axios works); `watchXHR()` watches XHR alone.
- **Password fields.** New `shy` mood: covers its eyes while a password field is focused, and peeks when the password is shown.
- **Looks at errors.** On a validation error the pal turns toward the offending field (`gaze` option). `pal.lookAt()` does it on demand.
- **Frustration.** New `concerned` mood on rage clicks, and a `frustration` event you can send to analytics.
- **Page errors** (opt-in, `errors: true`): wince on uncaught errors and unhandled rejections.
- **Delight.** New `wink` mood on copy and when poked; `cheer` when the user returns after a while (`welcomeBack`).
- **Interaction.** Poke, drag (position remembered), and dismiss with a close button (remembered). `show()`, `hide()`, `dismiss()`, `hidden`. `interactive`, `remember` and `storageKey` options.
- **Characters.** `character: 'blob' | 'cat' | 'ghost'`, or your own images per mood.
- **Inline position.** `position: 'inline'` renders in the page flow.
- **Plugins.** `pal.use(plugin)` with namespaced signals; `pal.signal()` / `pal.clearSignal()`.
- **Shortcuts.** `watch` and `requests` options on `createPal()`.
- **Framework adapters.** `pagepal/react` (`PagePal`, `usePal`, `PagePalProvider`, `usePagePal`) and `pagepal/vue` (`PagePal`, `usePal`).
- `react(mood, Infinity)` holds any mood.
- Typed `on()` for `change`, `frustration`, `poke` and `dismiss`.
- Real-browser tests (Playwright) including visual baselines for every mood of every character.

### Changed
- **The pal is interactive by default**, so it now receives clicks in its 72px corner. Pass `interactive: false` for the previous click-through behavior.
- `isError` receives a `{ status, ok, url }` object (a `Response` still satisfies it).
- Idle detection treats returning to the tab as activity.
- Script-tag bundle is ~10.5 KB gzipped (was ~6.5 KB), from the new moods, characters and watchers.

### Fixed
- Dizzy stars no longer stack on one spot with reduced motion.

## 0.1.0

- First version: `dizzy`, `wince`, `cheer`, `waiting`, `sad`, `sleepy`, `dozing`; `watch()`, `watchFetch()`, `react()`, `say()`, `on('change')`.
