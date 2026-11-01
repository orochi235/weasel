import { defineConfig } from 'tsup';
import { weaselIcons } from '../icons-plugin/src/index';

// `page.global.js`, the script the host adds to its page by default: one classic script holding core
// and everything it needs, built from the siblings' `dist` after `tsup.config.ts` has emptied this
// package's.
export default defineConfig({
  entry: { page: 'src/page.ts' },
  format: ['iife'],
  platform: 'browser',
  target: 'es2022',
  noExternal: [/.*/],
  dts: false,
  clean: false,
  minify: true,
  loader: { '.css': 'empty', '.less': 'empty' },
  esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })],
});
