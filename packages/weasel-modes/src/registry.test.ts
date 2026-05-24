import { describe, it, expect, vi } from 'vitest';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES, NORMAL, PATH_EDIT } from './presets/default';

describe('createModeRegistry', () => {
  it('starts in the initial mode', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(r.current().id).toBe('normal');
  });

  it('setMode swaps the active mode and bumps version', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const v0 = r.getVersion();
    r.setMode('path-edit');
    expect(r.current().id).toBe('path-edit');
    expect(r.getVersion()).toBeGreaterThan(v0);
  });

  it('setMode notifies subscribers, deduplicates same-mode calls, and respects unsubscribe', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const listener = vi.fn();
    const unsubscribe = r.subscribe(listener);

    r.setMode('path-edit');
    expect(listener).toHaveBeenCalledTimes(1);

    r.setMode('path-edit');  // same mode — should NOT notify
    expect(listener).toHaveBeenCalledTimes(1);

    r.setMode('isolation');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    r.setMode('normal');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('setMode rejects unknown ids', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(() => r.setMode('not-a-mode')).toThrow();
  });

  it('byId returns the mode definition', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(r.byId('path-edit')).toBe(PATH_EDIT);
    expect(r.byId('normal')).toBe(NORMAL);
  });
});
