import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// tokens.css and fonts.css are copied verbatim by the `build` script rather
// than run through a bundler. Neither uses CSS Modules, and a bundler would
// rewrite fonts.css's `../fonts/*.woff2` URLs, which are deliberately relative
// to the published package root.
export default defineConfig(
  packagePreset({
    entry: { index: 'src/index.ts', react: 'src/react.tsx' },
    external: ['react'],
  }),
);
