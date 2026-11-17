// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { packageSourceDirs, shouldTransform } from './vite-plugin-callback-source.ts';

const repoRoot = resolve(import.meta.dirname, '../..');

describe('callbackSourcePlugin include dirs', () => {
  it('reach every package that declares tools and actions, not only core', () => {
    const dirs = packageSourceDirs(repoRoot);
    for (const file of [
      'packages/editing/src/actions/move/action.ts',
      'packages/editing/src/tools/rect/useRectTool.ts',
      'packages/routing/src/interactions/actions/action.ts',
      'packages/core/src/tools/builtin/hand/useHandTool.ts',
    ]) expect(shouldTransform(resolve(repoRoot, file), dirs), file).toBe(true);
  });

  it('match a directory, not every path sharing its prefix', () => {
    const dirs = ['/repo/packages/core/src/tools'];
    expect(shouldTransform('/repo/packages/core/src/tools/a.ts', dirs)).toBe(true);
    expect(shouldTransform('/repo/packages/core/src/toolsX/a.ts', dirs)).toBe(false);
  });
});
