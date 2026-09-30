// The <script> tag build: everything on `window.PagePal`, and <page-pal> defined.
export * from './index';
export { analytics, summarize, toGA4, toPlausible, toPostHog, toSegment, describeElement } from './analytics/index';
export { debugPanel } from './debug';
export * as watchers from './watchers/index';
export { PagePalElement } from './element';
