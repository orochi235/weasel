import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { A11Y_SHARDS, shardOf } from './a11y.shards';

describe('the a11y shards', () => {
  it('have one browser test file each, so every story file is judged', () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /^a11y\.\d+\.browser\.test\.tsx$/.test(f)).sort();
    expect(files).toEqual(Array.from({ length: A11Y_SHARDS }, (_, i) => `a11y.${i}.browser.test.tsx`).sort());
  });

  it('split the story files with none left out or judged twice', () => {
    const paths = Array.from({ length: 101 }, (_, i) => `p${String(i).padStart(3, '0')}`);
    const shards = Array.from({ length: A11Y_SHARDS }, (_, i) => shardOf(paths, i));
    expect(shards.flat().sort()).toEqual(paths);
  });
});
