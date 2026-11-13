import { describe, expect, it } from 'vitest';
import { exportsSubpath, isShipped } from './check-declared-imports.mjs';

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
