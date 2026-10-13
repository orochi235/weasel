import { describe, it, expect } from 'vitest';
import {
  moveAction,
  type InvocationCtx,
  type LayoutDep,
  type LayoutStrategy,
  type NodeId,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';
import {
  squarePolygon,
  type P,
  makeScene,
  makeCtx,
} from './testing/moveLayoutStubs';

describe('moveAction layout drop-target mode', () => {
  type Mode = NonNullable<LayoutDep['dropTarget']>;
  type Strategy = LayoutStrategy<P>;
  type Region = NonNullable<Strategy['dropRegion']>;
  type Drag = NonNullable<InvocationCtx['drag']>;

  /** Drag the leaf x (center {305,305}) so its center lands on `to`. */
  const dragTo = (to: { x: number; y: number }): Drag => ({
    start: { x: 305, y: 305 },
    current: to,
    delta: { x: to.x - 305, y: to.y - 305 },
  } as Drag);

  /** P (root, 0..200) holds D (0..100); S (root, 50..150) is painted after
   *  both. Dropped at {75,75} the leaf x is inside all three: D is deepest, S
   *  is on top, and by default only P declares a drop region (local
   *  {50,50}–{100,100}) — so each mode picks a different container. */
  function overlapping(regions: Partial<Record<'P' | 'D' | 'S', Region>> = {
    P: () => ({ kind: 'rect', x: 50, y: 50, width: 50, height: 50 }),
  }) {
    const scene = makeScene(
      {
        P: { x: 0, y: 0, width: 200, height: 200 },
        D: { x: 0, y: 0, width: 100, height: 100 },
        S: { x: 50, y: 50, width: 100, height: 100 },
        x: { x: 300, y: 300, width: 10, height: 10 },
      },
      { P: null, D: 'P', S: null, x: null },
      { P: ['D'], D: [], S: [] },
      ['P', 'S', 'x'],
    );
    (scene as unknown as { renderOrder(): NodeId[] }).renderOrder =
      () => ['P', 'D', 'S', 'x'] as NodeId[];
    const reflowedInto: string[] = [];
    const strategy = (id: 'P' | 'D' | 'S'): Strategy => {
      const grid = tileGrid<P>({ cols: 2, rows: 1 });
      const out: Strategy = {
        ...grid,
        reflowPoses: (container, children, dragged, target) => {
          reflowedInto.push(container.id);
          return grid.reflowPoses(container, children, dragged, target);
        },
      };
      if (regions[id]) out.dropRegion = regions[id];
      return out;
    };
    const layouts = { P: strategy('P'), D: strategy('D'), S: strategy('S') };
    return { scene, layouts, reflowedInto };
  }

  function dropWith(
    fixture: ReturnType<typeof overlapping>,
    mode: Mode | undefined,
    drag: Drag = dragTo({ x: 75, y: 75 }),
  ) {
    const { scene, layouts } = fixture;
    const ctx = (d?: Drag): InvocationCtx => {
      const c = makeCtx(scene, ['x'], d, layouts);
      if (mode) c.deps.layout!.dropTarget = mode;
      return c;
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctx());
    handle.onMove!(ctx(drag));
    const duringDrag = [...fixture.reflowedInto];
    handle.onEnd!(ctx(drag), 'commit');
    const ops = scene.appliedBatches.at(-1)?.ops ?? [];
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'x');
    return { parent: reparent?.args?.toParentId ?? null, duringDrag };
  }

  it('defaults to the innermost container, whatever is painted over it', () => {
    expect(dropWith(overlapping(), undefined).parent).toBe('D');
    expect(dropWith(overlapping(), 'innermost').parent).toBe('D');
  });

  it("'topmost' picks the container painted last, across unrelated subtrees", () => {
    expect(dropWith(overlapping(), 'topmost').parent).toBe('S');
  });

  it("'region' considers only containers that declare a drop region", () => {
    expect(dropWith(overlapping(), 'region').parent).toBe('P');
    expect(dropWith(overlapping({}), 'region').parent).toBeNull();
  });

  it('previews the reflow in the container the commit lands in', () => {
    for (const [mode, want] of [['innermost', 'D'], ['topmost', 'S'], ['region', 'P']] as const) {
      const { duringDrag, parent } = dropWith(overlapping(), mode);
      expect(parent).toBe(want);
      expect(new Set(duringDrag)).toEqual(new Set([want]));
    }
  });

  it('a declared region replaces the container body as its hit area in every mode', () => {
    // D's region is its own top-left corner, so {75,75} no longer reaches it.
    const corner: Region = () => ({ kind: 'rect', x: 0, y: 0, width: 20, height: 20 });
    expect(dropWith(overlapping({ D: corner }), 'innermost').parent).toBe('S');
    // S's region reaches past its body, to world {10..30}.
    const outside: Region = () => ({ kind: 'rect', x: -40, y: -40, width: 20, height: 20 });
    expect(dropWith(overlapping({ S: outside }), 'topmost', dragTo({ x: 20, y: 20 })).parent).toBe('S');
  });

  it('tests a region in the container local frame, as a path or a predicate', () => {
    const seen: Array<{ x: number; y: number }> = [];
    const predicate = (p: { x: number; y: number }) => { seen.push(p); return p.x < 60; };
    // S sits at {50,50}, so {75,75} is local {25,25}.
    expect(dropWith(overlapping({ S: () => predicate }), 'region').parent).toBe('S');
    expect(seen.at(-1)).toEqual({ x: 25, y: 25 });

    const square: Region = () => squarePolygon(0, 0, 30, 30);
    expect(dropWith(overlapping({ S: square }), 'region').parent).toBe('S');
    expect(dropWith(overlapping({ S: square }), 'region', dragTo({ x: 120, y: 120 })).parent).toBeNull();
  });
});
