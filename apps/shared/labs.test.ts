import { describe, expect, it } from 'vitest';
import { LABS } from './labs';

describe('LABS', () => {
  // Each lab's vite base ends in a slash, and vite answers 404 for the base without it.
  it('links every lab at a path ending in a slash', () => {
    for (const lab of LABS) expect(new URL(lab.href, 'http://site').pathname, lab.label).toMatch(/\/$/);
  });
});
