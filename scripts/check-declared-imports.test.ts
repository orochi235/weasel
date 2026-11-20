import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportsSubpath, isShipped, optionalPeersBySubpath } from './check-declared-imports.mjs';

const own = 'packages/renderer';

describe('isShipped', () => {
  it('ships ordinary source', () => {
    expect(isShipped('packages/renderer/src/mesh.ts', own, {})).toBe(true);
  });

  it('does not ship tests or an unexported testing helper', () => {
    expect(isShipped('packages/renderer/src/mesh.test.ts', own, {})).toBe(false);
    expect(isShipped('packages/devtools/src/testing/mountCanvas.tsx', 'packages/devtools', { exports: { '.': './dist/index.js' } })).toBe(false);
  });

  it('ships a testing module the manifest exports', () => {
    const manifest = { exports: { './testing/glRecorder': { import: './dist/testing/glRecorder.js' } } };
    expect(isShipped('packages/renderer/src/testing/glRecorder.ts', own, manifest)).toBe(true);
    expect(isShipped('packages/renderer/src/testing/other.ts', own, manifest)).toBe(false);
  });

  it("does not ship a component's lab, which only its stories reach, but ships labkit's own lab", () => {
    expect(isShipped('packages/ui/src/components/Along/lab/labActions.tsx', 'packages/ui', {})).toBe(false);
    expect(isShipped('packages/labkit/src/lab/Lab.tsx', 'packages/labkit', {})).toBe(true);
  });
});

describe('exportsSubpath', () => {
  const exports = { '.': './dist/index.js', './test-seams': './dist/test-seams.js', './themes/*': './dist/themes/*.js' };

  it('finds an exact subpath and one a pattern matches', () => {
    expect(exportsSubpath(exports, '.')).toBe(true);
    expect(exportsSubpath(exports, './test-seams')).toBe(true);
    expect(exportsSubpath(exports, './themes/win9x')).toBe(true);
  });

  it('refuses a subpath the manifest does not list', () => {
    expect(exportsSubpath(exports, './src/internal')).toBe(false);
    expect(exportsSubpath(exports, './themes/')).toBe(false);
    expect(exportsSubpath(undefined, './x')).toBe(false);
  });
});

describe('optionalPeersBySubpath', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const fixture = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'optional-peers-'));
    dir = root;
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  };

  const manifest = {
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './mesh': { types: './dist/mesh/index.d.ts', import: './dist/mesh/index.js' },
    },
    peerDependencies: { cutter: '^1.0.0', other: '^2.0.0' },
    peerDependenciesMeta: { cutter: { optional: true } },
  };

  it('maps a subpath to the optional peer its entry loads through relative imports', () => {
    const root = fixture({
      'src/index.ts': "import type { Cut } from 'cutter';\nexport type One = Cut;\n",
      'src/mesh/index.ts': "export { cut } from './cut';\n",
      'src/mesh/cut.ts': "import cutter from 'cutter';\nimport other from 'other';\nexport const cut = cutter(other);\n",
    });
    expect([...optionalPeersBySubpath(root, manifest)]).toEqual([['./mesh', ['cutter']]]);
  });

  it('finds nothing in a package with no optional peer', () => {
    const root = fixture({ 'src/mesh/index.ts': "import cutter from 'cutter';\n" });
    expect(optionalPeersBySubpath(root, { ...manifest, peerDependenciesMeta: undefined }).size).toBe(0);
  });

  it("reads geom's own entries: booleans loads polygon-clipping, tessellate and warp load earcut", () => {
    const geom = JSON.parse(readFileSync('packages/geom/package.json', 'utf8'));
    const peers = optionalPeersBySubpath('packages/geom', geom);
    expect(peers.get('./booleans')).toContain('polygon-clipping');
    expect(peers.get('./tessellate')).toContain('earcut');
    expect(peers.get('./warp')).toContain('earcut');
    expect(peers.has('.')).toBe(false);
  });
});
