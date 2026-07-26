import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// tokens.css is copied verbatim by the `build` script rather than run through
// a bundler. It is a plain stylesheet of `--wzl-*` custom properties with no
// imports, no CSS Modules, and no asset references — there is nothing for a
// bundler to do, and passing it through one would only risk rewriting it.
export default defineConfig(packagePreset({ entry: { index: 'src/index.ts' } }));
