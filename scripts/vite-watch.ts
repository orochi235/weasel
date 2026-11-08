import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { watchRecovery } from '../packages/forge/src/vite/watchRecovery.ts';
import { settledWatch } from '../packages/forge/src/vite/watchSettle.ts';

/**
 * How every dev server in the repo watches files.
 *
 * It stays off the agent worktrees under this checkout's `.claude/`: each is a whole second checkout, with its own
 * `node_modules`, and watching them costs the server for files it never serves. Anchored to this checkout, so a
 * server started inside a worktree still watches itself.
 *
 * Off macOS it reports a change only once the write has settled, as forge's plugin does (`settledWatch`);
 * `scripts/watch-settle.mjs` reproduces the change chokidar drops without it.
 *
 * An edit the OS never reports is served anyway, by `watchRecovery` from `@weasel-js/forge/vite`.
 */
export function devWatch(): Plugin[] {
  const ignored = resolve(import.meta.dirname, '..', '.claude') + '/**';
  const settle = settledWatch(undefined) ?? {};
  return [
    {
      name: 'weasel:dev-watch',
      config: () => ({ server: { watch: { ignored: [ignored], ...settle } } }),
    },
    watchRecovery(),
  ];
}
