# pagepal

A mascot that reacts to what's happening on your page, and first-party UX analytics that tell you where users struggle.

Most mascots are decoration. pagepal gives users real feedback: it winces at a form error and looks at the field that caused it, waits while requests are in flight, covers its eyes while you type a password, and looks confused when a button does nothing. The same signals feed **analytics you own**: rage and dead clicks, form errors and abandonment, failing endpoints, sent only where you choose.

| Page event | Mood |
| --- | --- |
| Form validation error | 😬 `wince`, and it looks at the bad field |
| Successful form submit | 🥳 `cheer` |
| Required fields filling in | cheeks warm up; 😉 `wink` when all are valid |
| `fetch` / XHR in progress | 👀 `waiting`, with a progress ring for big uploads |
| Request fails | 😬 `wince` |
| Password field focused | 🙈 `shy` (peeks when the password is shown) |
| Rage clicks | 😟 `concerned` |
| Dead clicks (nothing happens) | 🤨 `confused` |
| Offline | 😢 `sad` (and a `cheer` when you're back) |
| Scrolling fast | 😵‍💫 `dizzy` |
| Copying text, being poked | 😉 `wink` |
| Back after a while | 🥳 `cheer` |
| Dark mode | 😪 `sleepy` |
| User idle | 😴 `dozing` |
| Uncaught errors (opt-in) | 😬 `wince` |

It also steps aside for chat widgets, cookie banners and the field you're typing in. Three characters (`blob`, `cat`, `ghost`) or your own. No dependencies. Shadow DOM, so your CSS and its CSS never collide. Respects `prefers-reduced-motion`. Users can drag it, and dismiss it with the mouse or the keyboard.

## Install

```bash
npm install pagepal
```

```ts
import { createPal } from 'pagepal';

createPal({ watch: 'form#signup', requests: true });
```

Or with no build step:

```html
<script src="https://unpkg.com/pagepal"></script>
<page-pal watch="form#signup" requests></page-pal>
```

## Analytics

```ts
import { createPal } from 'pagepal';
import { analytics } from 'pagepal/analytics';

const ux = analytics({ endpoint: '/api/ux' });
createPal({ watch: 'form#signup', requests: true, plugins: [ux] });
```

Batches are POSTed to your endpoint as `{"events": [...]}` with `navigator.sendBeacon` (so they survive the page closing), as `text/plain` so no CORS preflight is needed. Parse the body as JSON:

```ts
app.post('/api/ux', express.text({ type: '*/*' }), async (req, res) => {
  const { events } = JSON.parse(req.body);
  await db.insert('ux_events', events);
  res.sendStatus(204);
});
```

### What gets recorded

| Event | Fields (besides `type`, `ts`, `page`, `view`) |
| --- | --- |
| `page_view` | `referrer` (origin only), `viewport` (`mobile`/`tablet`/`desktop`) |
| `rage_click` | `element`, `clicks` |
| `dead_click` | `element` |
| `form_error` | `form`, `field`, `validity` (e.g. `valueMissing`), `source` |
| `form_submit` | `form`, `success`, `durationMs`, `errors` |
| `form_abandon` | `form`, `lastField`, `progress`, `durationMs`, `errors` (sent when the user leaves) |
| `request_error` | `method`, `url`, `status`, `durationMs` |
| `request_slow` | same, for requests over `slowRequestMs` (3s) |
| `offline` | `durationMs` |
| `pal_dismiss`, `pal_poke` | how people feel about the mascot |
| `page_summary` | `durationMs`, `waitMs` (time spent waiting on requests), `counts` |
| `js_error` (opt-in) | `message` (masked), `source`, `line` |

Elements are described like `button#pay "Pay $##"` or `input[name="email"]`: id, `name`, or a test id (`data-testid`, `data-track`, or your own `data-pagepal-name`), plus a short label for buttons and links.

### Privacy by default

- **Nothing is sent unless you configure `endpoint` or `send`.** There is no pagepal server.
- **Never** records what users type. Form fields are identified by `name`, never by value.
- Digits and emails in labels are masked (`"Pay $##"`, `[email]`). Add `data-pagepal-mask` to an element to drop its label, or `captureText: false` to drop all labels.
- URLs lose their query string and hash, and ID-like path segments become `:id` (`/users/123/orders` → `/users/:id/orders`).
- Error messages are off by default (they can contain personal data); `include: [..., 'js_error']` turns them on, masked.
- **Do Not Track and Global Privacy Control turn it off** (`respectPrivacySignals: false` to override if your legal basis allows it).
- **Consent:** `analytics({ consent: false })` records nothing until you call `ux.consent(true)`. Revoking drops anything unsent.
- `view` is a random per-page-view id. Nothing is stored on the device and nothing links views together.
- `redact(event)` gets the last word: return a modified event, or `null` to drop it.
- `sampleRate: 0.1` records 10% of page views.

### Sending to the tools you already use

```ts
import { analytics, toGA4, toPostHog, toSegment, toPlausible } from 'pagepal/analytics';

analytics({ send: toPostHog(posthog) });
analytics({ send: [toGA4(gtag), toSegment(window.analytics)], endpoint: '/api/ux' });
```

Adapters send `pagepal_<type>` events with flat properties, and skip `page_view` (those tools already count views).

### Dashboards

`summarize(events)` turns raw events, from any number of views, into the numbers a dashboard needs: frustration hotspots, form errors by field, form funnels with the field people abandon on, failing and slow endpoints, frustration and dismiss rates, and average wait time. `ux.summary()` does the same for the current page view.

```ts
import { summarize } from 'pagepal/analytics';
const { frustration, forms, requests, frustrationRate } = summarize(await db.select('ux_events'));
```

`npm run demo` includes a working dashboard built on it (`/demo/dashboard.html`).

## Forms

```ts
pal.watch('form#signup');            // selector: also works for forms rendered later
pal.watch(formElement);              // or an element (a form, or a container of forms)
pal.watch('#checkout', { cheer: false, progress: false });
```

- **Wince** on native validation errors (`invalid` events) and whenever a field gets `aria-invalid="true"`. Component libraries like MUI and Chakra set that for you; with React Hook Form or Formik, pass `aria-invalid={!!error}`.
- **Look** at the first invalid field (`gaze: { duration }`, or `gaze: false`).
- **Warm up** as required fields become valid, and wink when they all are.
- **Cheer** on submit, unless a field is still invalid a moment later (so JS validators that flag fields inside their submit handler don't cause a cheer-then-wince).

## Requests

```ts
pal.watchRequests({                             // fetch and XMLHttpRequest (axios uses XHR)
  delay: 150,                                   // don't flash "waiting" for fast requests
  filter: (url) => !String(url).includes('/analytics'),
  isError: (res) => res.status >= 500,          // which responses cause a wince
  progress: 100_000,                            // progress ring for XHR transfers ≥ 100 KB
});
```

Network failures cause a wince; aborted requests, and requests cut off because the user is leaving the page, don't. Unwatching restores the originals.

## Frustration: rage clicks and dead clicks

- **Rage click:** 4+ clicks within a second in one spot (3 would catch triple-click text selection). Tune with `frustration: { clicks, within, radius }`.
- **Dead click:** a click on something that looks clickable (a button, link, `role="button"`, or anything with `cursor: pointer`) after which nothing happens for 1s: no DOM change, navigation, scroll, focus change or request. Form fields, labels, media, new-tab and download links are ignored, and so is anything with `data-pagepal-ignore` (e.g. copy-to-clipboard buttons). Tune with `deadClicks: { timeout, ignore }`.

Both emit `frustration` events (`kind: 'rage-click' | 'dead-click'`) and feed analytics. A rage click isn't also counted as dead clicks.

## Staying out of the way

- **Avoids overlaps:** if something fixed or sticky (a chat widget, cookie banner, sticky footer) occupies its corner, it slides past it or, if there's no room, moves to the other side. It also slides aside while the focused field is underneath it. `avoid: { selectors: ['#my-banner'] }` adds elements; `avoid: false` turns it off. A spot the user dragged it to is left alone.
- **Drag and dismiss:** users can drag it anywhere and hide it with ✕. The ✕ appears on hover, after a tap on touch screens, or via Tab for keyboard users, and is labelled for screen readers (`labels: { dismiss: '…' }` to translate). The position and the dismissal are remembered per site. `pal.show()` brings it back.

## Characters and color

```ts
createPal({ character: 'cat' });              // 'blob' (default), 'cat', 'ghost'

import { defineCharacter } from 'pagepal';
const robot = defineCharacter({
  name: 'robot',
  color: '#5cc8ff',
  body: 'M15 20 H85 V92 H15 Z',                                  // 100×100 viewBox
  back: '<rect class="fur" x="47" y="4" width="6" height="16"/>', // antenna, drawn behind
});
createPal({ character: robot });              // every mood's face and effects work

createPal({ character: { images: { neutral: '/pal/idle.png', cheer: '/pal/yay.png' } } }); // your own art
```

Color, in order of precedence: the `color` option; a `--pagepal-color` CSS variable on your page (live, so it can follow your theme); with `color: 'auto'`, your `<meta name="theme-color">` or a common accent variable (grays and near-whites are skipped); otherwise the character's own color.

## Smaller bundles: `pagepal/core`

`createPal()` includes every watcher. If you only need some, build from the core and pick watchers from `pagepal/watchers`. Unused ones are tree-shaken out:

```ts
import { createPalCore } from 'pagepal/core';
import { forms, requests, deadClicks } from 'pagepal/watchers';

createPalCore({ plugins: [forms('#signup'), requests(), deadClicks()] });
```

Watchers: `forms`, `requests`, `scroll`, `network`, `darkMode`, `idle`, `password`, `rageClicks`, `deadClicks`, `avoidOverlaps`, `copy`, `welcomeBack`, `pageErrors`. Characters: `blob` ships with the core; import `cat`/`ghost` from `pagepal/characters`.

Measured sizes (minified + gzip, checked in CI by `npm run size`):

| Setup | Size |
| --- | --- |
| `createPalCore` + `forms` + `requests` | 11.1 KB |
| `createPal()` | 15.0 KB |
| `createPal()` + `analytics` | 18.1 KB |
| `<script>` build (everything, incl. `<page-pal>`) | 20.1 KB |

Most of the core is the artwork: CSS and SVG for 12 animated moods.

## Frameworks

### Web component (any framework, or none)

```html
<page-pal watch="form#signup" requests character="cat" analytics-endpoint="/api/ux"></page-pal>
```

`import 'pagepal/element'` registers it in bundled apps. Boolean attributes accept `="false"`, e.g. `idle="false"`. `position="inline"` renders it inside the element. `element.pal` gives you the `Pal`; it fires `pagepal:ready`.

### React

```tsx
import { PagePal, PagePalProvider, usePagePal } from 'pagepal/react';

<PagePal watch="form#signup" requests character="cat" />

// Or share it, e.g. to cheer after the server says OK:
<PagePalProvider requests>
  <App />
</PagePalProvider>

function SaveButton() {
  const pal = usePagePal();
  return <button onClick={async () => { await save(); pal?.react('cheer'); }}>Save</button>;
}
```

`usePal(options)` returns the `Pal` (or `null` before mount). Options are read once on mount; change `key` to recreate.

### Vue

```vue
<script setup>
import { PagePal } from 'pagepal/vue';
</script>

<template>
  <PagePal watch="form#signup" requests :options="{ character: 'ghost' }" />
</template>
```

`usePal(options)` returns a `shallowRef<Pal | null>`.

## Plugins, signals and debugging

```ts
pal.use(({ signal, clear, progress, document }) => {
  const onProgress = (e) => { signal('upload', 'waiting'); progress(e.detail.fraction); };
  const onDone = () => { clear('upload'); progress(null); signal('done', 'cheer', 1500); };
  document.addEventListener('upload:progress', onProgress);
  document.addEventListener('upload:done', onDone);
  return () => {
    document.removeEventListener('upload:progress', onProgress);
    document.removeEventListener('upload:done', onDone);
  };
});
```

Plugin signals are namespaced, so plugins can't clobber each other or the built-in watchers. Without a plugin, `pal.signal(key, mood, ms?)`, `pal.clearSignal(key)` and `pal.progress(value | null)` do the same.

**"Why is it sad?"** `pal.use(debugPanel())` (from `pagepal/debug`) shows the current mood, every active signal with its priority and time left, and recent events.

When several moods apply, the highest priority wins, falling back when it ends:

```
cheer 90 > wink 88 > wince 85 > dizzy 80 > concerned 75 > confused 74 > sad 70 > shy 65 > waiting 60 > dozing 40 > sleepy 20 > neutral 0
```

Override with `priorities`.

## Events

`pal.on(event, listener)` returns an unsubscribe function.

| Event | Payload |
| --- | --- |
| `change` | `(mood, previous)` |
| `frustration` | `{ kind, target, clicks, x, y }` |
| `formError` | `{ form, field, source, validity }` |
| `formSubmit` | `{ form, success }` |
| `formProgress` | `{ form, field, progress }` |
| `request` | `{ kind, method, url, status, ok, duration, failed, aborted }` |
| `connection` | `{ online, offlineMs? }` |
| `poke`, `dismiss` | none |

## Options

```ts
createPal({
  character: 'blob',
  position: 'bottom-right',   // 'bottom-left' | 'top-right' | 'top-left' | 'inline'
  size: 72,
  offset: 20,
  color: undefined,           // or any CSS color, or 'auto'
  zIndex: 2147483000,
  container: document.body,

  watch: undefined,           // selector, element, or an array of them
  requests: false,            // true or WatchRequestsOptions
  plugins: [],                // analytics(), debugPanel(), your plugins, or watchers

  interactive: true,          // poke, drag, dismiss; false = click-through
  keyboard: true,             // dismiss button in the tab order
  labels: { dismiss: 'Hide mascot' },
  remember: true,
  storageKey: 'pagepal',

  scroll: { threshold: 2 },
  idle: { timeout: 30_000 },
  network: true,
  darkMode: true,             // or { detect: () => boolean }
  password: true,
  gaze: { duration: 2500 },
  frustration: { clicks: 4, within: 1000, radius: 30 },
  deadClicks: { timeout: 1000 },
  avoid: true,
  copy: true,
  welcomeBack: { after: 30_000 },
  errors: false,

  durations: { cheer: 1800, wince: 1200, dizzy: 1200, wink: 900, concerned: 1800, confused: 1600 },
  priorities: {},
});
```

Every watcher accepts `false` to turn it off. `createPal()` is safe during SSR: without a `document` it does nothing.

## Accessibility

The artwork is `aria-hidden`: it echoes feedback your page should already give in accessible form, and announcing a mascot's mood would be noise. The dismiss button is a real, labelled button in the tab order (`keyboard: false` removes it; `interactive: false` makes the whole pal inert and hidden from assistive tech). With `prefers-reduced-motion: reduce`, it changes expression without animating.

## Development

```bash
npm install
npm test            # unit tests (vitest + jsdom)
npm run e2e         # real-browser tests (Playwright; uses installed Edge, or PW_CHANNEL=chromium)
npm run e2e:update  # refresh visual baselines after an intentional art change
npm run typecheck
npm run build       # all entry points + the <script> build
npm run size        # bundle-size budget
npm run demo        # http://localhost:5173 (demo, /demo/dashboard.html, /demo/playground.html)
```

## License

MIT
