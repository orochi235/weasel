import { describe, it, expect } from 'vitest';
import { DEFAULT_MODES, byId } from './default';

describe('default mode preset', () => {
  it('ships exactly six stock modes', () => {
    expect(DEFAULT_MODES.length).toBe(6);
  });

  it('includes the six documented mode ids', () => {
    const ids = DEFAULT_MODES.map((m) => m.id).sort();
    expect(ids).toEqual(['crop', 'free-transform', 'isolation', 'normal', 'path-edit', 'text-edit']);
  });

  it('path-edit is soft, scoping, blue', () => {
    const m = byId('path-edit');
    expect(m.kind).toBe('soft');
    expect(m.scoping).toBe(true);
    expect(m.workspace?.tint).toBe('#3b82f6');
    expect(m.allows).toContain('edits-anchors');
  });

  it('free-transform is strict, non-scoping, amber, with commit/cancel shortcuts', () => {
    const m = byId('free-transform');
    expect(m.kind).toBe('strict');
    expect(m.scoping).toBe(false);
    expect(m.workspace?.tint).toBe('#f59e0b');
    expect(m.commit?.shortcut).toBeDefined();
    expect(m.cancel?.shortcut).toBeDefined();
  });

  it('normal has no workspace tint', () => {
    const m = byId('normal');
    expect(m.workspace).toBeUndefined();
  });

  it('byId throws for unknown id', () => {
    expect(() => byId('nope')).toThrow();
  });
});
