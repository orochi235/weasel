import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir`, with when it was last modified and its size. */
const filesUnder = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      filesUnder(path, out);
      continue;
    }
    // Several vitest processes prune at once under scripts/vitest-overlap.mjs, so a file can go mid-walk.
    const stat = statSync(path, { throwIfNoEntry: false });
    if (stat) out.push({ path, mtimeMs: stat.mtimeMs, size: stat.size });
  }
  return out;
};

/**
 * Deletes every file under `dir` last modified before `before` (ms since the epoch), then the oldest of
 * the rest until what is left takes at most `maxBytes`; returns how many it deleted.
 */
export const pruneCache = (dir, { before, maxBytes = Infinity }) => {
  if (!existsSync(dir)) return 0;
  const newestFirst = filesUnder(dir).sort((a, b) => b.mtimeMs - a.mtimeMs);
  let kept = 0;
  let removed = 0;
  for (const file of newestFirst) {
    if (file.mtimeMs >= before && kept + file.size <= maxBytes) {
      kept += file.size;
      continue;
    }
    rmSync(file.path, { force: true });
    removed++;
  }
  return removed;
};
