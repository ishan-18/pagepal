// Bundle-size budget: builds realistic app entry points against dist/ with esbuild
// (minified, tree-shaken) and fails if any exceeds its gzip budget.
// Usage: node scripts/size.mjs   (run after `npm run build`)
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));

/** name → [app code, gzip budget in KB]. Budgets are the 1.0.0 sizes plus ~5% headroom. */
const scenarios = {
  'core + forms + requests': [
    `import { createPalCore } from 'pagepal/core'; import { forms, requests } from 'pagepal/watchers';
     createPalCore({ plugins: [forms('#signup'), requests()] });`,
    11.5,
  ],
  'createPal() (everything but analytics)': [`import { createPal } from 'pagepal'; createPal();`, 15.5],
  'createPal() + analytics': [
    `import { createPal } from 'pagepal'; import { analytics } from 'pagepal/analytics';
     createPal({ plugins: [analytics({ endpoint: '/ux' })] });`,
    18.8,
  ],
  'analytics alone': [`import { analytics } from 'pagepal/analytics'; console.log(analytics);`, 3.7],
};

const files = { '<script> build (dist/pagepal.global.js)': ['dist/pagepal.global.js', 21] };

let failed = false;
const report = (name, bytes, budget) => {
  const kb = gzipSync(bytes).length / 1024;
  const ok = kb <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(42)} ${kb.toFixed(2).padStart(6)} KB gz  (budget ${budget} KB)`);
};

for (const [name, [code, budget]] of Object.entries(scenarios)) {
  const result = await build({
    stdin: { contents: code, resolveDir: root, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    platform: 'browser',
    // `pagepal/*` resolves through package.json "exports" (self-reference), like an app would.
    logLevel: 'silent',
  });
  report(name, result.outputFiles[0].contents, budget);
}
for (const [name, [file, budget]] of Object.entries(files)) report(name, readFileSync(new URL(file, `file://${root}/`)), budget);

if (failed) {
  console.error('\nBundle size budget exceeded.');
  process.exit(1);
}
