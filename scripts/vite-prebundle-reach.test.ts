import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { globImportsIn } from './vite-prebundle-reach.ts';

let dir: string | null = null;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('globImportsIn', () => {
  it('leaves out a directory a failed run named like a story file', () => {
    dir = mkdtempSync(join(tmpdir(), 'reach-'));
    writeFileSync(join(dir, 'Select.stories.tsx'), 'export {};');
    mkdirSync(join(dir, '__screenshots__', 'Select.stories.tsx'), { recursive: true });
    const code = "const stories = import.meta.glob('./**/*.stories.tsx');";
    expect(globImportsIn(code, dir)).toEqual([join(dir, 'Select.stories.tsx')]);
  });
});
