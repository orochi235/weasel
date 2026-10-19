import type { Plugin } from 'vite';

/**
 * Keeps a dev server off the agent worktrees under `.claude/`: each is a whole second checkout,
 * with its own `node_modules`, and watching them costs the server for files it never serves.
 */
export function skipWorktrees(): Plugin {
  return {
    name: 'weasel:skip-worktrees',
    config: () => ({ server: { watch: { ignored: ['**/.claude/**'] } } }),
  };
}
