// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageNameOf } from './packageName.ts';

describe('packageNameOf', () => {
  let root: string;
  const manifest = (dir: string, name: string) => {
    mkdirSync(join(root, dir, 'src'), { recursive: true });
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify({ name }));
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'forge-package-name-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('names the nearest manifest under top', () => {
    manifest('pkg', 'pkg');
    expect(packageNameOf(join(root, 'pkg', 'src', 'a.ts'), join(root, 'pkg'))).toBe('pkg');
  });

  it("does not read a sibling directory's manifest that only shares top's name as a prefix", () => {
    manifest('pkg-old', 'old');
    expect(packageNameOf(join(root, 'pkg-old', 'src', 'a.ts'), join(root, 'pkg'))).toBeNull();
  });

  it("reads top's own manifest when top ends in a separator", () => {
    manifest('pkg', 'pkg');
    expect(packageNameOf(join(root, 'pkg', 'src', 'a.ts'), `${join(root, 'pkg')}/`)).toBe('pkg');
  });
});
