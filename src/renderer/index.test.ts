import { describe, it, expect } from 'vitest';
import { WeaselRenderer, mat3, tessellate } from './index';

describe('weasel-gl barrel', () => {
  it('exports WeaselRenderer', () => {
    expect(WeaselRenderer).toBeDefined();
  });
  it('exports mat3 and tessellate', () => {
    expect(typeof mat3.identity).toBe('function');
    expect(typeof tessellate).toBe('function');
  });
});
