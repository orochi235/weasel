import { describe, it, expect } from 'vitest';
import { createScopingDim } from './scopingLayer';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

describe('createScopingDim', () => {
  it('returns alpha=1 for every id when active mode has scoping=false', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['a']) });
    expect(dim.alphaFor('a')).toBe(1);
    expect(dim.alphaFor('b')).toBe(1);
  });

  it('returns target alpha for in-scope ids, dim alpha for others, in path-edit', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const dim = createScopingDim({
      registry: reg,
      getTargetIds: () => new Set(['target']),
      dimAlpha: 0.3,
    });
    expect(dim.alphaFor('target')).toBe(1);
    expect(dim.alphaFor('other')).toBe(0.3);
  });

  it('reacts to mode changes (no caching across modes)', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['t']) });
    expect(dim.alphaFor('other')).toBe(1);  // normal: no scoping

    reg.setMode('path-edit');
    expect(dim.alphaFor('other')).toBe(0.3);  // path-edit: scoping
  });

  it('isPointerInteractive mirrors alphaFor === 1 (true) vs dim (false)', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['t']) });
    expect(dim.isPointerInteractive('t')).toBe(true);
    expect(dim.isPointerInteractive('x')).toBe(false);
  });
});
