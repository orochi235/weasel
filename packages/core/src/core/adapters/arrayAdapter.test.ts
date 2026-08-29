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

describe('arrayAdapter — commitPaste', () => {
  type Obj = { id: string; x: number; y: number; width: number; height: number };

  function makeFixture(opts: { nextId?: () => string } = {}) {
    const items: Obj[] = [
      { id: 'a', x: 10, y: 20, width: 10, height: 10 },
      { id: 'b', x: 30, y: 40, width: 10, height: 10 },
    ];
    const ref = { current: items };
    const setItems = (updater: (items: Obj[]) => Obj[]): void => {
      ref.current = updater(ref.current);
    };
    const adapter = arrayAdapter<Obj, Obj>({
      ref,
      setItems,
      toPose: (o) => o,
      fromPose: (o, p) => ({ ...o, ...p }),
      poseBounds: (p) => p,
      ...(opts.nextId ? { nextId: opts.nextId } : {}),
    });
    return { adapter, ref };
  }

  it('returns [] for an empty snapshot', () => {
    const { adapter } = makeFixture();
    expect(adapter.commitPaste!({ items: [] }, { dx: 5, dy: 5 })).toEqual([]);
  });

  it('clones with fresh ids and applies the offset when no dropPoint is supplied', () => {
    let n = 0;
    const { adapter, ref } = makeFixture({ nextId: () => `new-${n++}` });
    const out = adapter.commitPaste!(
      { items: ref.current },
      { dx: 100, dy: 200 },
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: 'new-0', x: 110, y: 220, width: 10, height: 10 });
    expect(out[1]).toEqual({ id: 'new-1', x: 130, y: 240, width: 10, height: 10 });
    // Source must not be mutated.
    expect(ref.current[0]).toEqual({ id: 'a', x: 10, y: 20, width: 10, height: 10 });
  });

  it('centers the cluster bbox at dropPoint when supplied (offset ignored)', () => {
    let n = 0;
    const { adapter, ref } = makeFixture({ nextId: () => `new-${n++}` });
    // Cluster bbox: x[10..40], y[20..50]. Center = (25, 35).
    // Drop at (200, 300) → dx = 175, dy = 265.
    const out = adapter.commitPaste!(
      { items: ref.current },
      { dx: 999, dy: 999 },
      { dropPoint: { worldX: 200, worldY: 300 } },
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ x: 10 + 175, y: 20 + 265 });
    expect(out[1]).toMatchObject({ x: 30 + 175, y: 40 + 265 });
  });

  it('falls back to default ids when no nextId is provided (no crash)', () => {
    const { adapter, ref } = makeFixture();
    const out = adapter.commitPaste!(
      { items: ref.current },
      { dx: 1, dy: 1 },
    );
    expect(out).toHaveLength(2);
    expect(out[0].id).toBeTypeOf('string');
    expect(out[0].id).not.toBe('a');
    expect(out[1].id).not.toBe('b');
    expect(out[0].id).not.toBe(out[1].id);
  });
});

describe('arrayAdapter — getChildren answers the ordered contract', () => {
  type Obj = { id: string; x: number; y: number; width: number; height: number; parent?: string };

  function makeFixture() {
    const items: Obj[] = [
      { id: 'root-a', x: 0, y: 0, width: 10, height: 10 },
      { id: 'root-b', x: 20, y: 0, width: 10, height: 10 },
      { id: 'kid', x: 1, y: 1, width: 2, height: 2, parent: 'root-a' },
    ];
    const ref = { current: items };
    return arrayAdapter<Obj, Obj>({
      ref,
      setItems: (u) => { ref.current = u(ref.current); },
      toPose: (o) => o,
      getParent: (id) => ref.current.find((o) => o.id === id)?.parent ?? null,
      getChildren: (id) => ref.current.filter((o) => o.parent === id).map((o) => o.id),
    });
  }

  it('answers a node id with that node\'s children', () => {
    expect(makeFixture().getChildren!('root-a')).toEqual(['kid']);
  });

  it('answers null with the root siblings, in z-order', () => {
    // The ops read `getChildren` with the OrderedAdapter meaning, where null
    // is the root. An adapter that answers [] there silently loses the slot
    // an op captured, and undo appends.
    expect(makeFixture().getChildren!(null)).toEqual(['root-a', 'root-b']);
  });
});
