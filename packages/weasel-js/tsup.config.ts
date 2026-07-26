import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// Pure alias for @weasel-js/core: every entry is a one-line `export *` from the
// matching core entry, so `npm install weasel-js` works for people who don't
// think to reach for a scoped package named "core".
//
// core is a real `dependency`, NOT inlined — inlining would give anyone holding
// both `weasel-js` and `@weasel-js/core` two copies of the kit, which is the
// duplicate-module-identity hazard this whole packaging arc removed. With the
// exact pin plus lockstep versioning, npm dedupes them to one install.
export default defineConfig(
  packagePreset({
    entry: { index: 'src/index.ts', 'move': 'src/move.ts', 'resize': 'src/resize.ts', 'insert': 'src/insert.ts', 'clipboard': 'src/clipboard.ts', 'clone': 'src/clone.ts', 'patterns-builtin': 'src/patterns-builtin.ts', 'renderer': 'src/renderer.ts', 'routing': 'src/routing.ts' },
    external: ['react', 'react-dom'],
  }),
);
