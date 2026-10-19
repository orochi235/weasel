import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Keeps a dev server off the agent worktrees under this checkout's `.claude/`: each is a whole
 * second checkout, with its own `node_modules`, and watching them costs the server for files it
 * never serves. Anchored to this checkout, so a server started inside a worktree still watches itself.
 */
export function skipWorktrees(): Plugin {
  const ignored = resolve(import.meta.dirname, '..', '.claude') + '/**';
  return {
    name: 'weasel:skip-worktrees',
    config: () => ({ server: { watch: { ignored: [ignored] } } }),
  };
}
