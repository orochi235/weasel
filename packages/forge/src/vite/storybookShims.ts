import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const PREVIEW_API = /^@?storybook\/preview-api$/;

/** Points `storybook/preview-api` and `@storybook/preview-api` at forge's shim. */
export function storybookShims(): Plugin {
  // Resolved from forge's own location, through the app's aliases, so a monorepo reaches source and an install reaches dist.
  return {
    name: 'weaselforge:storybook-shims',
    enforce: 'pre',
    resolveId(id) {
      if (!PREVIEW_API.test(id)) return undefined;
      return this.resolve('@weasel-js/forge/preview-api', fileURLToPath(import.meta.url), { skipSelf: true });
    },
  };
}
