/**
 * Build-time identity for anything bundled out of this repo: which kit
 * version the code came from, and when it was compiled.
 *
 * In-repo apps, dev servers, storybook, and vitest all resolve `@weasel-js/*`
 * to package *source* via `weaselAliases`, so the version baked into each
 * package's published `dist` never reaches them. Every config that builds kit
 * source therefore has to re-apply the same defines — hence one helper rather
 * than a copy per config.
 *
 * Published builds get `__WEASEL_CORE_VERSION__` from core's own
 * `tsup.config.ts` instead; both paths read `packages/core/package.json`, so
 * there is a single source of truth and changesets' version bump is the only
 * place the number is edited.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Read `version` out of a workspace's package.json. */
export function packageVersion(repoRoot: string, pkg: string): string {
  const manifest = join(repoRoot, 'packages', pkg, 'package.json');
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string }).version ?? '0.0.0-unknown';
}

/**
 * `define` entries for vite/vitest configs. Spread into an existing `define`
 * block — this never replaces one.
 *
 * `__WEASEL_BUILD_DATE__` is captured when the config is loaded, which means
 * the moment of the build in CI and the moment the dev server started in
 * development. Consumers that display it should distinguish the two
 * (`import.meta.env.PROD`) rather than presenting a dev-server start time as a
 * build date.
 */
export function weaselDefines(repoRoot: string): Record<string, string> {
  return {
    __WEASEL_CORE_VERSION__: JSON.stringify(packageVersion(repoRoot, 'core')),
    __WEASEL_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  };
}
