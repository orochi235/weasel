// Lets a plain `node` script import the package's TypeScript source directly.
//
// Node strips types on its own but will not guess an extension, and the source
// imports extensionlessly (`./types`). Without this, a script that wants to
// render exactly what ships has to keep its own copy of the renderer — and a
// copy drifts: the first one did, inside an hour, the moment a path role was
// added.
//
//   node --import ./packages/cursor/scripts/ts-resolve.mjs <script>

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['.ts', '.tsx']) {
        if (existsSync(fileURLToPath(new URL(base.href + ext)))) {
          return nextResolve(specifier + ext, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
