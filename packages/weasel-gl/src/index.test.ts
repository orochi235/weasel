import { describe, it, expect } from 'vitest';
import * as gl from './index';

describe('weasel-gl barrel', () => {
  it('exports a placeholder marker so the package is importable', () => {
    expect(gl).toHaveProperty('__weaselGlPackage');
    expect(gl.__weaselGlPackage).toBe(true);
  });
});
