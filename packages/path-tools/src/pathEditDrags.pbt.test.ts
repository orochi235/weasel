/**
 * Property test of the path-edit drags on a real scene, through the real `editAnchors` dep: Simplify brush,
 * Lengthen, a corner widget, a balance grip, and the grip's double-click. Each gesture, committed or canceled,
 * leaves a well-formed finite path; it records one undo step exactly when it changed the path; undo and redo land on
 * the paths before and after; and the last-operation panel's replay with the same params lands where the drag did.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { openPathEnds, pathEndAnchorIndex, pathToAnchors, type AnchorSet } from '@weasel-js/geom';
import type { Action, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { balanceHandlesAction, editCornerAction, equalizeHandlesAction, lengthenPathAction, simplifyBrushAction } from './index';
import { editHarness, type EditHarness } from './shared/testing/editHarness';
import { checkPath, densePath, penPath, point, runs, snap, tally, timeoutFor } from './pbt.fixture';

const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

interface Drag {
  action: Action;
  /** Affordance kind prefix, for drags that start on one: `anchor`, `corner`, `balance`. */
  on?: string;
  params?: fc.Arbitrary<Record<string, unknown>>;
}

const DRAGS: Drag[] = [
  { action: simplifyBrushAction, params: fc.record({ radiusPx: fc.integer({ min: 1, max: 80 }), tolerance: fc.constantFrom(0, 0.5, 2, 10) }, { requiredKeys: [] }) },
  { action: lengthenPathAction, on: 'anchor', params: fc.record({ mode: fc.constantFrom('tangent', 'curvature', 'eased') }, { requiredKeys: [] }) },
  { action: editCornerAction, on: 'corner', params: fc.record({ shape: fc.constantFrom('round', 'bevel', 'scoop', 'notch', 'square', 'squircle') }, { requiredKeys: [] }) },
  { action: balanceHandlesAction, on: 'balance' },
];

const gesture = fc.record({
  drag: fc.constantFrom(...DRAGS),
  index: fc.nat({ max: 12 }),
  selected: fc.array(fc.nat({ max: 12 }), { maxLength: 3 }),
  press: point,
  moves: fc.array(fc.record({ to: point, shift: fc.boolean() }), { minLength: 0, maxLength: 6 }),
  commit: fc.constantFrom(true, true, true, false),
  replay: fc.boolean(),
  aim: fc.constantFrom(true, true, false),
}).chain((g) => (g.drag.params ?? fc.constant(undefined)).map((params) => ({ ...g, params })));

const t = tally();

function deps(h: EditHarness) {
  return { ...h.deps(), view: VIEW } as never;
}

const ctxAt = (h: EditHarness, world: { x: number; y: number }, start: { x: number; y: number }, kind: string | undefined, shift = false): InvocationCtx => ({
  world, screen: world, modifiers: { ...NO_MODS, shift }, deps: deps(h),
  drag: {
    start, current: world, delta: { x: world.x - start.x, y: world.y - start.y }, screenDelta: { x: world.x - start.x, y: world.y - start.y },
    ...(kind ? { affordance: { kind } } : {}),
  } as InvocationCtx['drag'],
});

function anchorCount(h: EditHarness): number {
  return pathToAnchors(h.path()).anchors.reduce((n, sub) => n + sub.length, 0);
}

type G = { drag: Drag; index: number; selected: number[]; press: { x: number; y: number }; moves: { to: { x: number; y: number }; shift: boolean }[]; commit: boolean; replay: boolean; aim: boolean; params: Record<string, unknown> | undefined };

/** Run gesture `g` on `h`, and check what it left. */
function checkGesture(h: EditHarness, given: G): void {
  let g = given;
  const n = Math.max(1, anchorCount(h));
  h.setSelected([...new Set(g.selected.map((k) => k % n))]);
  const before = snap(h.path());
  const at0 = h.scene.historyIndex();
  const id = g.drag.action.id;
  if (g.aim) {
    // Press on the anchor the affordance names, and drag over its neighbors, so the gesture has something to act on.
    const flat = pathToAnchors(h.path()).anchors.flat();
    const near = (k: number, off: { x: number; y: number }) => {
      const a = flat[k % flat.length]!;
      return { x: a.x + (off.x % 7), y: a.y + (off.y % 7) };
    };
    if (g.drag.on === 'anchor') {
      // Lengthen presses an open end, and drags anywhere.
      const ends = openPathEnds(h.path()).map((e) => pathEndAnchorIndex(pathToAnchors(h.path()) as AnchorSet, e)).filter((k) => k >= 0);
      const end = ends.length > 0 ? ends[g.index % ends.length]! : g.index;
      const p = near(end, { x: 0, y: 0 });
      g = { ...g, index: end, press: p, moves: g.moves.map((m) => ({ ...m, to: { x: p.x + m.to.x / 4, y: p.y + m.to.y / 4 } })) };
    } else {
      g = { ...g, press: near(g.index, { x: 0, y: 0 }), moves: g.moves.map((m, j) => ({ ...m, to: near(g.index + j + 1, m.to) })) };
    }
  }
  const kind = g.drag.on ? `${g.drag.on}:${g.index % n}` : undefined;
  const handle = (g.drag.action.invoker as OngoingInvoker).start(ctxAt(h, g.press, g.press, kind), g.params ? { params: g.params } : undefined);
  for (const m of g.moves) handle.onMove?.(ctxAt(h, m.to, g.press, kind, m.shift));
  const last = g.moves.at(-1)?.to ?? g.press;
  handle.onEnd?.(ctxAt(h, last, g.press, kind), g.commit ? 'commit' : 'cancel');
  const after = snap(h.path());
  const at1 = h.scene.historyIndex();
  checkPath(h.path());
  if (!g.commit) {
    expect(after, `${id} canceled and changed the path`).toEqual(before);
    expect(at1, `${id} canceled and recorded a step`).toBe(at0);
    t.count(`${id}:cancel`);
    return;
  }
  const changed = JSON.stringify(after) !== JSON.stringify(before);
  expect(at1 - at0, `${id} records one step for one gesture, or none`).toBeLessThanOrEqual(1);
  expect(at1 - at0 === 1, `${id} recorded a step exactly when it changed the path`).toBe(changed);
  t.count(`${id}:${changed ? 'changed' : 'idle'}`);
  if (!changed) return;
  h.scene.undo();
  expect(snap(h.path()), `${id} undone`).toEqual(before);
  h.scene.redo();
  expect(snap(h.path()), `${id} redone`).toEqual(after);
  if (g.replay && handle.replay) {
    h.scene.undo();
    handle.replay(g.params ?? {});
    expect(snap(h.path()), `${id} replayed with its own params`).toEqual(after);
    expect(h.scene.historyIndex(), `${id} replay records one step`).toBe(at1);
    t.count(`${id}:replay`);
  }
}

describe('path-edit drags on a real scene, property', () => {
  it('leave a well-formed path, record a step exactly when they change it, and undo, redo, and replay exactly', () => {
    fc.assert(fc.property(fc.oneof(penPath, densePath), fc.array(gesture, { minLength: 1, maxLength: 4 }), (p, gs) => {
      const h = editHarness(p);
      try {
        for (const g of gs) checkGesture(h, g);
      } finally {
        h.unmount();
      }
    }), runs(250));
    for (const d of DRAGS) {
      expect(t.get(`${d.action.id}:changed`), `${d.action.id} ${t}`).toBeGreaterThan(5);
    }
    for (const k of ['simplifyBrush:replay', 'lengthenPath:replay', 'editCorner:replay']) expect(t.get(k), `${k} ${t}`).toBeGreaterThan(4);
  }, timeoutFor(250, 120));

  it('equalizing a grip changes the path exactly when it records a step, and undoes exactly', () => {
    fc.assert(fc.property(penPath, fc.nat({ max: 12 }), (p, k) => {
      const h = editHarness(p);
      try {
        const kind = `balance:${k % Math.max(1, anchorCount(h))}`;
        const before = snap(h.path());
        const at0 = h.scene.historyIndex();
        (equalizeHandlesAction.invoker as ImmediateInvoker).run(deps(h), { affordance: { kind } });
        const after = snap(h.path());
        checkPath(h.path());
        const changed = JSON.stringify(after) !== JSON.stringify(before);
        expect(h.scene.historyIndex() - at0 === 1, 'recorded a step exactly when it changed the path').toBe(changed);
        t.count(`equalize:${changed ? 'changed' : 'idle'}`);
        if (changed) {
          h.scene.undo();
          expect(snap(h.path())).toEqual(before);
        }
      } finally {
        h.unmount();
      }
    }), runs(80));
    expect(t.get('equalize:changed'), `${t}`).toBeGreaterThan(3);
  }, timeoutFor(80, 60));
});
