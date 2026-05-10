import { describe, expect, it } from 'vitest';
import { arrayAdapter } from './arrayAdapter';

describe('arrayAdapter — hitTestLasso', () => {
  type Obj = { id: string; x: number; y: number; width: number; height: number };

  // Three squares: A(0..10), B(20..30), C(40..50) along x; all y(0..10).
  function makeFixture() {
    const items: Obj[] = [
      { id: 'a', x: 0,  y: 0, width: 10, height: 10 },
      { id: 'b', x: 20, y: 0, width: 10, height: 10 },
      { id: 'c', x: 40, y: 0, width: 10, height: 10 },
    ];
    const ref = { current: items };
    const setItems = (updater: (items: Obj[]) => Obj[]): void => {
      ref.current = updater(ref.current);
    };
    return arrayAdapter<Obj, Obj>({
      ref,
      setItems,
      toPose: (o) => o,
      fromPose: (o, p) => ({ ...o, ...p }),
      poseBounds: (p) => p,
    });
  }

  it('centers mode: lasso over rect A picks only A', () => {
    const adapter = makeFixture();
    const hits = adapter.hitTestLasso!(
      [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }],
      'centers',
    );
    expect(hits).toEqual(['a']);
  });

  it('enclosed mode: only fully-contained rects are returned', () => {
    const adapter = makeFixture();
    // Polygon spans x = -5..35, fully contains A and B; clips C.
    const hits = adapter.hitTestLasso!(
      [{ x: -5, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: -5, y: 15 }],
      'enclosed',
    );
    expect(hits.sort()).toEqual(['a', 'b']);
  });

  it('intersect mode: includes rects whose edges cross the polygon', () => {
    const adapter = makeFixture();
    // Polygon clips into B's right half; should still hit B.
    const hits = adapter.hitTestLasso!(
      [{ x: 25, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: 25, y: 15 }],
      'intersect',
    );
    expect(hits).toEqual(['b']);
  });

  it('degenerate polygon (< 3 vertices) returns []', () => {
    const adapter = makeFixture();
    expect(adapter.hitTestLasso!([{ x: 0, y: 0 }, { x: 1, y: 1 }], 'intersect')).toEqual([]);
  });
});
