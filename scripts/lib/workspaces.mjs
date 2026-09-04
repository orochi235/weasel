// The set of packages `changeset publish` would push, read from the workspace
// globs so nothing has to be listed twice.
//
// `weasel-js` is private on purpose: npm rejects the unscoped name as too
// similar to an existing package. Private workspaces are skipped throughout.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every non-private workspace, as `{ dir, manifest }`, sorted by package name. */
export function publishableWorkspaces(root = repoRoot) {
  const { workspaces = [] } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const out = [];
  for (const pattern of workspaces) {
    if (!pattern.endsWith('/*')) throw new Error(`unsupported workspace pattern: ${pattern}`);
    const parent = join(root, pattern.slice(0, -2));
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(parent, entry.name);
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      } catch {
        continue; // not a package (e.g. packages/den is an empty placeholder)
      }
      if (manifest.private) continue;
      out.push({ dir, manifest });
    }
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/** Just the names, for callers that don't need the manifests. */
export function publishablePackageNames(root = repoRoot) {
  return publishableWorkspaces(root).map(({ manifest }) => manifest.name);
}
