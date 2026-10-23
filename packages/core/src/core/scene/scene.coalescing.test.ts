import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { POSE, type Data, type Layer } from './testing/makeScene';

describe('coalescing (coalesceWindowMs)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function timedScene() {
    return createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
      coalesceWindowMs: 500,
    });
  }

  it('rapid setPose on one node merges into a single entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length; // the add
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 3, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 1);
    expect(s.get(id)?.pose).toEqual({ x: 3, y: 0, width: 10, height: 10 });
  });

  it('undo of a coalesced entry returns to the pre-burst state; redo to the final', () => {
    const s = timedScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 5, y: 0, width: 10, height: 10 });
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual({ x: 5, y: 0, width: 10, height: 10 });
  });

  it('a gap larger than the window starts a new entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(600); // outside the 500ms window
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
    s.undo();
    expect(s.get(id)?.pose).toEqual({ x: 1, y: 0, width: 10, height: 10 });
  });

  it('mutations on different nodes never merge', () => {
    const s = timedScene();
    const a = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const before = s.historyEntries().length;
    s.setPose(a, { x: 1, y: 0, width: 10, height: 10 });
    s.setPose(b, { x: 1, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('scene.batch entries are always discrete (recordEntry never coalesces)', () => {
    const s = timedScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.batch('drag', () => { s.setPose(id, { x: 1, y: 0, width: 10, height: 10 }); });
    vi.advanceTimersByTime(100);
    s.batch('drag', () => { s.setPose(id, { x: 2, y: 0, width: 10, height: 10 }); });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('a consumer op kind coalesces only through the key it declares', () => {
    const s = timedScene();
    const cell = { x: 0, y: 0 };
    s.registerOp<{ id: string; dx: number }>('nudge', {
      apply: (p) => { cell.x += p.dx; },
      revert: (p) => { cell.x -= p.dx; },
    });
    s.registerOp<{ id: string; from: number; to: number }>('setY', {
      apply: (p) => { cell.y = p.to; },
      revert: (p) => { cell.y = p.from; },
      coalesceKey: (p) => p.id,
    });

    s.recordOp({ kind: 'nudge', payload: { id: 'n', dx: 1 } });
    vi.advanceTimersByTime(100);
    s.recordOp({ kind: 'nudge', payload: { id: 'n', dx: 1 } });
    expect(s.historyEntries()).toHaveLength(2);
    s.undo();
    s.undo();
    expect(cell.x).toBe(0);

    s.recordOp({ kind: 'setY', payload: { id: 'n', from: 0, to: 1 } });
    vi.advanceTimersByTime(100);
    s.recordOp({ kind: 'setY', payload: { id: 'n', from: 1, to: 2 } });
    vi.advanceTimersByTime(100);
    s.recordOp({ kind: 'setY', payload: { id: 'm', from: 2, to: 3 } });
    expect(s.historyEntries()).toHaveLength(2);
    s.undo();
    s.undo();
    expect(cell.y).toBe(0);
  });

  it('sceneFromJSON forwards coalesceWindowMs', () => {
    const src = createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
    });
    const restored = sceneFromJSON(src.toJSON(), { coalesceWindowMs: 500 });
    const id = restored.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = restored.historyEntries().length;
    restored.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    restored.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    expect(restored.historyEntries().length).toBe(before + 1);
  });
});
