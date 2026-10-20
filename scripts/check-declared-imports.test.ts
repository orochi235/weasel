import { describe, expect, it } from 'vitest';
import { isShipped } from './check-declared-imports.mjs';

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
});
