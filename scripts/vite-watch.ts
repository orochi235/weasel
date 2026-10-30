import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * How every dev server in the repo watches files.
 *
 * It stays off the agent worktrees under this checkout's `.claude/`: each is a whole second checkout, with its own
 * `node_modules`, and watching them costs the server for files it never serves. Anchored to this checkout, so a
 * server started inside a worktree still watches itself.
 *
 * Off macOS it reports a change only once the file has held still for 50 ms. chokidar drops a `change` that lands
 * within 50 ms of the last one it reported, so a second quick save could leave the first text served until the next
 * save; a change that waits for the write to finish skips that drop (`scripts/watch-settle.mjs` reproduces it).
 * fsevents reports a file's changes at least ~100 ms apart, so macOS never hits the drop and skips the wait.
 */
export function devWatch(): Plugin {
  const ignored = resolve(import.meta.dirname, '..', '.claude') + '/**';
  const settle = process.platform === 'darwin' ? {} : { awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } };
  return {
    name: 'weasel:dev-watch',
    config: () => ({ server: { watch: { ignored: [ignored], ...settle } } }),
  };
}
