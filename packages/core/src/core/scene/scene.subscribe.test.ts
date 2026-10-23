import { describe, expect, it } from 'vitest';
import { POSE, makeScene } from './testing/makeScene';

describe('subscribe / getVersion', () => {
  it('notifies listeners on mutation and bumps version', () => {
    const s = makeScene();
    let count = 0;
    const v0 = s.getVersion();
    const off = s.subscribe(() => { count++; });
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    expect(count).toBe(1);
    expect(s.getVersion()).toBeGreaterThan(v0);
    off();
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    expect(count).toBe(1);
  });

  it('undo and redo also bump version', () => {
    const s = makeScene();
    s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const v = s.getVersion();
    s.undo();
    expect(s.getVersion()).toBeGreaterThan(v);
    const v2 = s.getVersion();
    s.redo();
    expect(s.getVersion()).toBeGreaterThan(v2);
  });
});
