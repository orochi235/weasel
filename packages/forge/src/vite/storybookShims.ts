import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Storybook specifiers a CSF file may import, and the forge entry each answers to. */
const SHIMS: readonly (readonly [RegExp, string])[] = [
  [/^@?storybook\/preview-api$/, '@weasel-js/forge/preview-api'],
  [/^@?storybook\/test$/, '@weasel-js/forge/play'],
];

/** Points the Storybook runtime specifiers a CSF file may carry at forge's own entries. */
export function storybookShims(): Plugin {
  // Resolved from forge's own location, through the app's aliases, so a monorepo reaches source and an install reaches dist.
  return {
    name: 'weaselforge:storybook-shims',
    enforce: 'pre',
    resolveId(id) {
      const hit = SHIMS.find(([pattern]) => pattern.test(id));
      if (!hit) return undefined;
      return this.resolve(hit[1], fileURLToPath(import.meta.url), { skipSelf: true });
    },
  };
}
