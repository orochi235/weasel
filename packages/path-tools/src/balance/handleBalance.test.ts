import { describe, expect, it } from 'vitest';
import { PathBuilder, pathFromD, pathToAnchors, type Affine, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { balanceHandlesAction, equalizeHandlesAction } from './handleBalance';

/** One segment from (0, 0) to (100, 0) whose handles lean toward a corner at
 *  (50, 50), the first 40% of the way there and the second 80%. Its balance
 *  grip sits at (40, 30), and slides from the chord's middle through it. */
function lopsided(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.curveTo(20, 20, 60, 40, 100, 0);
  return b.build();
}

function setup() {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = lopsided();
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  return { deps: { editAnchors: dep } as unknown as InvocationCtx['deps'], commits };
}

const at = (
  deps: InvocationCtx['deps'], x: number, y: number, kind?: string, mods: Partial<InvocationCtx['modifiers']> = {},
): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false, ...mods },
  deps,
  ...(kind ? { drag: { affordance: { kind } } as InvocationCtx['drag'] } : {}),
});

const handles = (path: PolygonPath) => {
  const [a, b] = pathToAnchors(path).anchors[0];
  return { out: a.outHandle!, in: b.inHandle! };
};

describe('balanceHandlesAction', () => {
  it('scales both handles together as the grip is dragged, in one commit', () => {
    const { deps, commits } = setup();
    const ongoing = balanceHandlesAction.invoker as OngoingInvoker;
    const handle = ongoing.start(at(deps, 40, 30, 'balance:0'), {});
    handle.onMove!(at(deps, 30, 60));
    expect(commits).toHaveLength(0);
    handle.onEnd!(at(deps, 30, 60), 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Balance handles');
    const h = handles(commits[0].path);
    expect(h.out.x).toBeCloseTo(40, 4);
    expect(h.out.y).toBeCloseTo(40, 4);
    expect(h.in.x).toBeCloseTo(20, 4);
    expect(h.in.y).toBeCloseTo(80, 4);
  });

  it('holds still under a length lock, from the dep or Mod, and not under an angle lock', () => {
    const drag = (lock: { angle: boolean; length: boolean } | null, mods: Partial<InvocationCtx['modifiers']> = {}) => {
      const { deps, commits } = setup();
      if (lock) deps.editAnchors!.setHandleLocks!(lock);
      const handle = (balanceHandlesAction.invoker as OngoingInvoker).start(at(deps, 40, 30, 'balance:0'), {});
      handle.onMove!(at(deps, 30, 60, undefined, mods));
      handle.onEnd!(at(deps, 30, 60, undefined, mods), 'commit');
      return commits;
    };
    expect(drag({ angle: false, length: true })).toHaveLength(0);
    expect(drag(null, { meta: true })).toHaveLength(0);
    expect(drag({ angle: true, length: false }, { shift: true })).toHaveLength(1);
  });

  it('scales the images of both handles on a path symmetric under the pathSymmetry dep', () => {
    // Two segments, each the other's mirror across x = 50, meeting at a smooth
    // anchor on the axis. The first segment's grip sits at (25, 25) and slides
    // up from the chord's middle (25, 15) by 10 per unit of scale.
    let current = pathFromD('M0 0 C10 20 40 30 50 30 C60 30 90 20 100 0') as PolygonPath;
    const commits: PolygonPath[] = [];
    const dep = makeEditAnchorsDep({
      editingId: 'p1',
      getEditablePath: () => current,
      applyEdit: (_id, worldPath) => {
        current = worldPath as PolygonPath;
        commits.push(current);
      },
    });
    const across50: Affine = [-1, 0, 0, 1, 100, 0];
    const deps = { editAnchors: dep, pathSymmetry: { transforms: () => [across50] } } as unknown as InvocationCtx['deps'];
    const handle = (balanceHandlesAction.invoker as OngoingInvoker).start(at(deps, 25, 25, 'balance:0'), {});
    // Pump events carry an empty dep bag, as the dispatcher sends them.
    handle.onMove!(at({} as InvocationCtx['deps'], 25, 35));
    handle.onEnd!(at({} as InvocationCtx['deps'], 25, 35), 'commit');
    expect(commits).toHaveLength(1);
    const [a, mid, b] = pathToAnchors(commits[0]).anchors[0];
    expect(a.outHandle!.x).toBeCloseTo(20, 4);
    expect(a.outHandle!.y).toBeCloseTo(40, 4);
    expect(mid.inHandle!.x).toBeCloseTo(30, 4);
    expect(mid.outHandle!.x).toBeCloseTo(70, 4);
    expect(mid.outHandle!.y).toBeCloseTo(30, 4);
    expect(b.inHandle!.x).toBeCloseTo(80, 4);
    expect(b.inHandle!.y).toBeCloseTo(40, 4);
  });

  it('declines a press that is not on a balance grip', () => {
    const { deps } = setup();
    const ongoing = balanceHandlesAction.invoker as OngoingInvoker;
    expect(ongoing.start(at(deps, 40, 30, 'anchor:0'), {})).toEqual({});
    expect(ongoing.start(at(deps, 40, 30), {})).toEqual({});
  });
});

describe('equalizeHandlesAction', () => {
  it('gives the double-clicked grip\'s handles one proportion', () => {
    const { deps, commits } = setup();
    (equalizeHandlesAction.invoker as ImmediateInvoker).run(deps, { affordance: { kind: 'balance:0' } });
    expect(commits).toHaveLength(1);
    const h = handles(commits[0].path);
    expect(h.out.x).toBeCloseTo(30, 4);
    expect(h.in.x).toBeCloseTo(70, 4);
    expect(h.in.y).toBeCloseTo(30, 4);
  });
});
