import { describe, it, expect, vi } from 'vitest';
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

describe('createScopingDim change notification', () => {
  it('notifies subscribers and bumps its version on a mode switch', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set(['t']) });
    const listener = vi.fn();
    dim.subscribe(listener);
    const v0 = dim.getVersion();
    reg.setMode('path-edit');
    expect(listener).toHaveBeenCalledOnce();
    expect(dim.getVersion()).toBeGreaterThan(v0);
  });

  it('invalidate() notifies when the target set changes inside one mode', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    let targets = new Set(['a']);
    const dim = createScopingDim({ registry: reg, getTargetIds: () => targets });
    const listener = vi.fn();
    dim.subscribe(listener);
    const v0 = dim.getVersion();
    targets = new Set(['b']);
    dim.invalidate();
    expect(listener).toHaveBeenCalledOnce();
    expect(dim.getVersion()).toBeGreaterThan(v0);
  });

  it('stops notifying once unsubscribed', () => {
    const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const dim = createScopingDim({ registry: reg, getTargetIds: () => new Set() });
    const listener = vi.fn();
    const off = dim.subscribe(listener);
    off();
    reg.setMode('path-edit');
    dim.invalidate();
    expect(listener).not.toHaveBeenCalled();
  });
});
