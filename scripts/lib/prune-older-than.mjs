import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Deletes every file under `dir` last modified before `cutoff` (ms since the epoch); returns how many. */
export const pruneOlderThan = (dir, cutoff) => {
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removed += pruneOlderThan(path, cutoff);
    else if (statSync(path).mtimeMs < cutoff) {
      rmSync(path, { force: true });
      removed++;
    }
  }
  return removed;
};
