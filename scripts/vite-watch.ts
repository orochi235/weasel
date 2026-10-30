import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * How every dev server in the repo watches files.
 *
 * It stays off the agent worktrees under this checkout's `.claude/`: each is a whole second checkout, with its own
 * `node_modules`, and watching them costs the server for files it never serves. Anchored to this checkout, so a
 * server started inside a worktree still watches itself.
 *
 * It reports a change only once the file has held still for 50 ms. chokidar drops a `change` that lands within
 * 50 ms of the last one it reported, so a second quick save could leave the first text served until the next save;
 * a change that waits for the write to finish skips that drop (`scripts/watch-settle.mjs` reproduces it).
 */
export function devWatch(): Plugin {
  const ignored = resolve(import.meta.dirname, '..', '.claude') + '/**';
  return {
    name: 'weasel:dev-watch',
    config: () => ({ server: { watch: { ignored: [ignored], awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } } } }),
  };
}
