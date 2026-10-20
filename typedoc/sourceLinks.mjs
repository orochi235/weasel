import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB = /github\.com[:/]([^/]+)\/([^/#]+?)(?:\.git)?\/?$|^github:([^/]+)\/(.+)$/;

/**
 * TypeDoc's link to a line of source, for the repository a manifest names.
 *
 * @param {string} repositoryUrl `repository.url` from a `package.json`
 */
export function sourceLinkTemplate(repositoryUrl) {
  const match = GITHUB.exec(repositoryUrl);
  if (!match) throw new Error(`sourceLinkTemplate: no link form known for the repository ${repositoryUrl}`);
  const owner = match[1] ?? match[3];
  const repo = match[2] ?? match[4];
  return `https://github.com/${owner}/${repo}/blob/{gitRevision}/{path}#L{line}`;
}

/**
 * TypeDoc options that link every declaration to the root manifest's repository at the
 * checked-out commit. Left to itself TypeDoc links only files it finds in `git ls-files`
 * of a directory holding a `.git` directory, which a git worktree does not have.
 * `{path}` is rooted at `displayBasePath`, so that has to be the repository root.
 *
 * @param {string} root absolute path to the repository root
 * @returns {Record<string, unknown>} empty when the tree is not a git checkout
 */
export function sourceLinkOptions(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  let gitRevision;
  try {
    gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return {};
  }
  return { disableGit: true, gitRevision, sourceLinkTemplate: sourceLinkTemplate(manifest.repository.url) };
}
