import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { createTransformOp } from '../ops/transform';

interface Pose { x: number; y: number }

function makeAdapter() {
  const state = new Map<string, Pose>();
  return {
    setPose: (id: string, pose: Pose) => state.set(id, { ...pose }),
    state,
  };
}

describe('createHistory', () => {
  it('applies a single op and pushes onto the undo stack', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    history.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 1 });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('undo reverses the last op', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    history.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('redo re-applies the undone op', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    history.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    history.undo();
    history.redo();
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 1 });
  });

  it('applyOps is atomic for undo', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    history.applyOps(
      [
        createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }),
        createTransformOp<Pose>({ id: 'b', from: { x: 0, y: 0 }, to: { x: 2, y: 2 } }),
      ],
      'Batch',
    );
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 1 });
    expect(adapter.state.get('b')).toEqual({ x: 2, y: 2 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(adapter.state.get('b')).toEqual({ x: 0, y: 0 });
  });

  it('apply after undo discards the redo stack', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    history.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    history.undo();
    history.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }));
    expect(history.canRedo()).toBe(false);
  });
});

describe('createHistory coalescing', () => {
  it('default (no coalesceWindowMs): every apply is a discrete entry', () => {
    const adapter = makeAdapter();
    const history = createHistory(adapter as any);
    for (let i = 1; i <= 3; i++) {
      history.apply(createTransformOp<Pose>({
        id: 'a', from: { x: i - 1, y: 0 }, to: { x: i, y: 0 }, coalesceKey: 'transform:a',
      }));
    }
    expect(adapter.state.get('a')).toEqual({ x: 3, y: 0 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 2, y: 0 }); // one step back
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 0 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
  });

  it('within window + matching coalesceKey: merges into one entry; undo returns to original from-state', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 100;
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 200;
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 2, y: 0 }, to: { x: 3, y: 0 }, coalesceKey: 'transform:a',
    }));
    expect(adapter.state.get('a')).toEqual({ x: 3, y: 0 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 }); // straight to original
    expect(history.canUndo()).toBe(false);
  });

  it('redo replays the latest coalesced to-state', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 100;
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 1, y: 0 }, to: { x: 5, y: 0 }, coalesceKey: 'transform:a',
    }));
    history.undo();
    history.redo();
    expect(adapter.state.get('a')).toEqual({ x: 5, y: 0 });
  });

  it('outside window: pushes a new entry instead of coalescing', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 600; // beyond the 500ms window
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, coalesceKey: 'transform:a',
    }));
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 0 }); // only the second step rolled back
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
  });

  it('window resets on each coalesce — sustained burst keeps merging', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 100, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    // 80ms apart × 5 — each within 100ms of the last, but total span > 100ms.
    for (let i = 2; i <= 6; i++) {
      t += 80;
      history.apply(createTransformOp<Pose>({
        id: 'a', from: { x: i - 1, y: 0 }, to: { x: i, y: 0 }, coalesceKey: 'transform:a',
      }));
    }
    expect(adapter.state.get('a')).toEqual({ x: 6, y: 0 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
  });

  it('different coalesceKey: pushes a new entry', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 100;
    history.apply(createTransformOp<Pose>({
      id: 'b', from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, coalesceKey: 'transform:b',
    }));
    history.undo();
    expect(adapter.state.get('b')).toEqual({ x: 0, y: 0 });
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 0 });
  });

  it('missing coalesceKey on either side: pushes a new entry', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a',
    }));
    t = 50;
    // No coalesceKey on this one.
    history.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 1, y: 0 }, to: { x: 2, y: 0 },
    }));
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 0 });
  });

  it('multi-op batch with matching coalesceKey multiset: coalesces', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.applyOps([
      createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a' }),
      createTransformOp<Pose>({ id: 'b', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:b' }),
    ], 'Nudge');
    t = 100;
    history.applyOps([
      // Order swapped — multiset still matches.
      createTransformOp<Pose>({ id: 'b', from: { x: 1, y: 0 }, to: { x: 5, y: 0 }, coalesceKey: 'transform:b' }),
      createTransformOp<Pose>({ id: 'a', from: { x: 1, y: 0 }, to: { x: 5, y: 0 }, coalesceKey: 'transform:a' }),
    ], 'Nudge');
    expect(adapter.state.get('a')).toEqual({ x: 5, y: 0 });
    expect(adapter.state.get('b')).toEqual({ x: 5, y: 0 });
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(adapter.state.get('b')).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
  });

  it('multi-op batches with different coalesceKey multisets: no coalesce', () => {
    let t = 0;
    const adapter = makeAdapter();
    const history = createHistory(adapter as any, { coalesceWindowMs: 500, now: () => t });
    history.applyOps([
      createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:a' }),
      createTransformOp<Pose>({ id: 'b', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, coalesceKey: 'transform:b' }),
    ], 'Move ab');
    t = 100;
    history.applyOps([
      // Only id=a this time.
      createTransformOp<Pose>({ id: 'a', from: { x: 1, y: 0 }, to: { x: 5, y: 0 }, coalesceKey: 'transform:a' }),
    ], 'Move a');
    history.undo();
    expect(adapter.state.get('a')).toEqual({ x: 1, y: 0 });
    expect(adapter.state.get('b')).toEqual({ x: 1, y: 0 });
  });
});
