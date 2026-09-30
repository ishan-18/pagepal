import { readFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';
import { defineConfig } from 'tsup';

/**
 * The SVG and CSS live in template literals, which minifiers leave alone.
 * Collapse their whitespace and drop comments at build time. These files keep
 * templates free of nested backticks, so a simple pairwise match is safe.
 */
const collapseTemplates: Plugin = {
  name: 'collapse-templates',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/](render[\\/](face|characters|styles|index)|characters|debug)\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const contents = source.replace(/`[^`]*`/g, (template) =>
        template
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s*([{};,>])\s*/g, '$1')
          .replace(/:\s+/g, ':'),
      );
      return { contents, loader: 'ts' };
    });
  },
};

const shared = {
  sourcemap: true,
  target: 'es2020',
  esbuildPlugins: [collapseTemplates],
} as const;

export default defineConfig([
  // npm consumers. Shared code goes into chunks, so each class exists once however
  // many entry points an app imports. React/Vue adapters import the core as `pagepal`.
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      core: 'src/entry-core.ts',
      watchers: 'src/watchers/index.ts',
      characters: 'src/characters.ts',
      analytics: 'src/analytics/index.ts',
      debug: 'src/debug.ts',
      element: 'src/element.ts',
      react: 'src/react.ts',
      vue: 'src/vue.ts',
    },
    format: ['esm', 'cjs'],
    splitting: true,
    dts: true,
    clean: true,
    external: ['pagepal', 'react', 'vue'],
  },
  // <script> tag consumers: everything on `window.PagePal`, and <page-pal> defined.
  {
    ...shared,
    entry: { pagepal: 'src/global.ts' },
    format: ['iife'],
    globalName: 'PagePal',
    minify: true,
  },
]);
