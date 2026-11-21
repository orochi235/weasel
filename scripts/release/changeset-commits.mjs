/**
 * `@changesets/git` as `@changesets/apply-release-plan` sees it under `version.ts`, with
 * `getCommitsThatAddFiles` answered from one `git log` over `.changeset/` rather than a
 * `git log --follow` per file, all started at once: at 3,826 pending changesets (2026-11-21) those
 * ran 11 minutes on five cores and then failed with EBADF.
 */
import { execFileSync } from 'node:child_process';
import { getCommitsThatAddFiles as followEach } from '@changesets/git';

export * from '@changesets/git';

/** The newest commit adding or copying each of `gitPaths`, as the original answers it; undefined
 *  for a path no commit added. A path the one pass misses (a changeset renamed since it was added)
 *  goes to the original's `--follow`, of which there are few. */
export async function getCommitsThatAddFiles(gitPaths, { cwd, short = false }) {
  const wanted = new Set(gitPaths);
  const log = execFileSync(
    'git',
    ['log', '--diff-filter=AC', '--name-only', `--pretty=format:%x00${short ? '%h' : '%H'}`, '--', '.changeset/'],
    { cwd, encoding: 'utf8', maxBuffer: 1 << 30 },
  );
  const found = new Map();
  for (const block of log.split('\0')) {
    const [sha, ...paths] = block.split('\n').filter(Boolean);
    for (const p of paths) if (wanted.has(p) && !found.has(p)) found.set(p, sha);
  }
  const missing = gitPaths.filter((p) => !found.has(p));
  const followed = missing.length ? await followEach(missing, { cwd, short }) : [];
  missing.forEach((p, i) => found.set(p, followed[i]));
  return gitPaths.map((p) => found.get(p));
}
