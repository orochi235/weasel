/**
 * `npm pack` workspace packages and extract each under its real name into a `node_modules` tree
 * outside the repo, where neither the repo's tsconfig `paths` nor its workspace symlinks reach: what
 * a consumer installing the tarballs gets.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Packs `dirs` (names under `packages/`) into `nodeModules`; returns each one's manifest. */
export async function packInto(repoRoot, dirs, nodeModules, tarballDir) {
  await mkdir(tarballDir, { recursive: true });
  const manifests = [];
  for (const dir of dirs) {
    const pkgDir = join(repoRoot, 'packages', dir);
    const out = execFileSync('npm', ['pack', '--silent', '--pack-destination', tarballDir], { cwd: pkgDir, encoding: 'utf8' });
    const tarball = out.trim().split('\n').pop();
    const manifest = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
    const dest = join(nodeModules, ...manifest.name.split('/'));
    await mkdir(dest, { recursive: true });
    // --strip-components=1 drops npm's `package/` wrapper directory.
    execFileSync('tar', ['-xzf', join(tarballDir, tarball), '-C', dest, '--strip-components=1']);
    manifests.push(manifest);
  }
  return manifests;
}
