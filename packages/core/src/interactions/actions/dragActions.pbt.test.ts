/**
 * Stateful property test: the ongoing actions (move, resize, rotate, clone, marquee) driven through their invokers over
 * long gestures, on a real scene among inserts, locks, hides, reparents, selection changes, undo, and redo. After every
 * gesture: it never throws, it holds no override once ended, a cancel leaves no trace, a commit records one entry or
 * changes nothing, no locked node moves, every stored number stays finite whatever the pointer did, and undo and
 * redo land on the states the model holds.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Action } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { createSetHiddenOp, createSetLockedOp } from 'core/ops/nodeFlags';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { areaSelectAction } from './defaults/areaSelect';
import { cloneAction } from './clone/action';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { alignCenterXAction, alignLeftAction } from './align/action';
import { distributeHorizontalAction } from './distribute/action';
import { reorderForwardAction } from './defaults/reorder';
import { nudgeRightAction } from './defaults/nudge';
import { flipAction } from './flip/action';
import { duplicateAction } from './defaults/duplicate';
import { deleteAction } from './defaults/delete';
import { groupAction, ungroupAction } from './defaults/group';
import { depsOf, makeScene, rectPose, runs, tally, timeoutFor, type TestScene } from './pbt.fixture';
import { assertFinite, drive, type Pt } from './drag.pbt.fixture';

interface Real { scene: TestScene }
interface Model { states: unknown[]; cursor: number }

const N = 100;
const seen = tally();

const snap = (scene: TestScene): unknown => JSON.parse(JSON.stringify(scene.toJSON()));
const ids = (scene: TestScene): NodeId[] => [...scene.nodes.keys()].sort();
const groups = (scene: TestScene): NodeId[] => ids(scene).filter((id) => scene.get(id)!.kind === 'group');
const pickFrom = <T,>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);

const placeOf = (scene: TestScene, id: NodeId): string => {
  const node = scene.get(id)!;
  return JSON.stringify({ pose: node.pose, parent: node.parent ?? null });
};
function lockedState(scene: TestScene): Map<NodeId, string> {
  const out = new Map<NodeId, string>();
  for (const id of scene.nodes.keys()) if (scene.isLocked(id)) out.set(id, placeOf(scene, id));
  return out;
}

function settle(m: Model, r: Real): boolean {
  const index = r.scene.historyIndex();
  if (index === m.cursor + 1) {
    m.states.splice(m.cursor + 1);
    m.states.push(snap(r.scene));
    m.cursor++;
    return true;
  }
  expect(index, 'a gesture records one entry or none').toBe(m.cursor);
  expect(snap(r.scene), 'a gesture that recorded nothing changed nothing').toEqual(m.states[m.cursor]);
  return false;
}

/** The marquee's dep over the real scene: the kit's own area walk, and the scene's selection. */
function areaDeps(scene: TestScene) {
  return {
    ...depsOf(scene),
    areaSelect: {
      hitTestArea: (b: { x: number; y: number; width: number; height: number }) => hitTestArea(scene as never, b),
      getSelection: () => [...scene.getSelection()],
      setSelection: (next: NodeId[]) => scene.setSelection(next),
    },
  } as never;
}

interface Variant { name: string; action: Action; handle?: boolean }
const VARIANTS: Variant[] = [
  { name: 'move', action: moveAction },
  { name: 'resize', action: resizeAction, handle: true },
  { name: 'rotate', action: rotateAction },
  { name: 'clone', action: cloneAction },
  { name: 'marquee', action: areaSelectAction },
];

class Drag implements fc.Command<Model, Real> {
  constructor(
    readonly variant: number, readonly picks: number[], readonly start: Pt, readonly path: Pt[],
    readonly reason: 'commit' | 'cancel', readonly handle: number,
  ) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const v = VARIANTS[this.variant % VARIANTS.length]!;
    const all = ids(r.scene);
    const chosen: NodeId[] = [];
    let at = this.picks[0] ?? 0;
    for (const skip of this.picks) {
      const id = pickFrom(all, at);
      if (id !== undefined && !chosen.includes(id)) chosen.push(id);
      at += 1 + (skip % 3);
    }
    r.scene.setSelection(chosen);
    const held = [...r.scene.getSelection()].sort();
    const locked = lockedState(r.scene);
    const deps = v.name === 'marquee' ? areaDeps(r.scene) : depsOf(r.scene);
    const handle = drive(v.action, deps, {
      start: this.start, path: this.path, reason: this.reason, ...(v.handle ? { handle: this.handle } : {}),
    });
    expect(r.scene.overrides.ids(), `${v.name} holds no override once ended`).toEqual([]);
    if (this.reason === 'cancel' || v.name === 'marquee') {
      expect(r.scene.historyIndex(), `${v.name} ${this.reason} records nothing`).toBe(m.cursor);
      expect(snap(r.scene), `${v.name} ${this.reason} leaves no trace`).toEqual(m.states[m.cursor]);
    }
    if (v.name === 'marquee' && this.reason === 'cancel') {
      expect([...r.scene.getSelection()].sort(), 'a canceled marquee keeps the selection').toEqual(held);
    }
    const recorded = settle(m, r);
    if (recorded) expect(m.states[m.cursor], `${v.name} recorded an entry changing nothing`).not.toEqual(m.states[m.cursor - 1]);
    assertFinite(r.scene.toJSON(), `${v.name} left the scene`);
    for (const [id, was] of locked) {
      if (r.scene.get(id)) expect(placeOf(r.scene, id), `${v.name} left locked ${id} where it was`).toBe(was);
    }
    for (const id of r.scene.getSelection()) {
      expect(r.scene.isLocked(id) || r.scene.isHidden(id), `${id} selected though out of reach`).toBe(false);
    }
    seen.count(handle === null ? `declined:${v.name}` : recorded ? v.name : `idle:${v.name}:${this.reason}`);
    if (recorded && locked.size > 0) seen.count('beside a lock');
    if (recorded && held.some((id) => id in Object.prototype)) seen.count('a prototype-named id');
    if (recorded && held.some((id) => { const b = r.scene.get(id)?.pose as RectPose | undefined; return b !== undefined && Math.min(b.width, b.height) < 1e-200; })) seen.count('a degenerate box');
    if (recorded && !this.path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) seen.count('past a wild point');
  }
  toString(): string {
    const v = VARIANTS[this.variant % VARIANTS.length]!;
    return `Drag(${v.name}, [${this.picks.join(',')}], ${JSON.stringify(this.start)}, ${JSON.stringify(this.path.map((p) => [p.x, p.y]))}, ${this.reason}${v.handle ? `, handle ${this.handle}` : ''})`;
  }
}

class Setup implements fc.Command<Model, Real> {
  constructor(readonly which: number, readonly pick: number, readonly other: number | null, readonly flag: boolean, readonly pose: RectPose) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const id = pickFrom(ids(r.scene), this.pick);
    const node = id ? r.scene.get(id) : undefined;
    const adapter = defaultCommitAdapter(r.scene);
    try {
      switch (this.which % 5) {
        case 0:
        case 1: {
          const parent = this.other === null ? null : pickFrom(groups(r.scene), this.other) ?? null;
          const kind = this.which % 5 === 1 && this.flag ? 'group' : 'mark';
          r.scene.applyBatch([createInsertOp({ node: { id: r.scene.mintId(), kind, layer: 'main', pose: this.pose, data: {}, parent } })], 'Insert', adapter);
          break;
        }
        case 2:
          if (node) r.scene.applyBatch([createSetLockedOp({ id: id!, from: node.locked === true, to: this.flag })], 'Lock', adapter);
          break;
        case 3:
          if (node) r.scene.applyBatch([createSetHiddenOp({ id: id!, from: node.hidden === true, to: this.flag })], 'Hide', adapter);
          break;
        default: {
          if (!node) break;
          const to = this.other === null ? null : pickFrom(groups(r.scene), this.other) ?? null;
          r.scene.applyBatch([createReparentOp({ id: id!, fromParentId: node.parent ?? null, toParentId: to })], 'Reparent', adapter);
        }
      }
    } catch {
      // A cycle or a locked node: the scene refused, and `settle` checks it left nothing behind.
    }
    settle(m, r);
  }
  toString(): string { return `Setup(${['insert', 'insertGroup', 'lock', 'hide', 'reparent'][this.which % 5]}, ${this.pick}, ${this.other}, ${this.flag}, ${JSON.stringify(this.pose)})`; }
}

/** Whether a stored coordinate lies within a few doublings of the double range's edge. */
const farOut = (scene: TestScene): boolean =>
  JSON.stringify(scene.toJSON(), (_k, v) => (typeof v === 'number' && Math.abs(v) > 1e300 ? 'far' : v)).includes('"far"');

/** The immediate actions the first pass covered, run on what the drags left. */
const IMMEDIATE: { name: string; action: Action; params?: Record<string, unknown> }[] = [
  { name: 'align.left', action: alignLeftAction },
  { name: 'align.centerX', action: alignCenterXAction },
  { name: 'distribute.x.gaps', action: distributeHorizontalAction, params: { mode: 'gaps' } },
  { name: 'distribute.x.centers', action: distributeHorizontalAction, params: { mode: 'centers' } },
  { name: 'reorder.front', action: reorderForwardAction, params: { distance: 'extreme' } },
  { name: 'nudge.right', action: nudgeRightAction, params: { magnitude: 'big' } },
  { name: 'flip.x', action: flipAction, params: { axis: 'x' } },
  { name: 'duplicate', action: duplicateAction },
  { name: 'delete', action: deleteAction },
  { name: 'group', action: groupAction },
  { name: 'ungroup', action: ungroupAction },
];

class Immediate implements fc.Command<Model, Real> {
  constructor(readonly which: number) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const v = IMMEDIATE[this.which % IMMEDIATE.length]!;
    // Within a few doublings of the double range's edge, a copy or a frame's inverse overflows; open in
    // docs/unruled.md (2026-11-11).
    if (farOut(r.scene)) { seen.count('immediate:far'); return; }
    const deps = depsOf(r.scene);
    const enabled = v.action.enabled ? v.action.enabled(deps, undefined, undefined, v.params) : true;
    (v.action.invoker as ImmediateInvoker).run(deps, v.params as never);
    expect(settle(m, r), `${v.name} recorded exactly when enabled (${String(enabled)})`).toBe(enabled === true);
    seen.count(enabled === true ? 'immediate' : 'immediate:off');
  }
  toString(): string { return `Immediate(${IMMEDIATE[this.which % IMMEDIATE.length]!.name})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor > 0; }
  run(m: Model, r: Real): void {
    expect(r.scene.undo()).toBe(true);
    m.cursor--;
    expect(snap(r.scene)).toEqual(m.states[m.cursor]);
    seen.count('Undo');
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor < m.states.length - 1; }
  run(m: Model, r: Real): void {
    expect(r.scene.redo()).toBe(true);
    m.cursor++;
    expect(snap(r.scene)).toEqual(m.states[m.cursor]);
    seen.count('Redo');
  }
  toString(): string { return 'Redo'; }
}

const pick = fc.nat({ max: 40 });
/** A size on the grid mostly, else none at all or one too small to see: a zero-size or subnormal box. */
const size = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 1, max: 60 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, Number.MIN_VALUE, 1e-300) },
);
const pose = fc.tuple(rectPose, size, size, fc.option(fc.constantFrom(Math.PI / 2, Math.PI / 6, -Math.PI / 4), { nil: undefined, freq: 3 }))
  .map(([p, width, height, rotation]) => ({ ...p, width, height, ...(rotation === undefined ? {} : { rotation }) }));
/** Ids `Object.prototype` holds, beside minted ones, for the nodes a run starts from. */
const startId = fc.option(fc.constantFrom('__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf'), { nil: undefined, freq: 2 });
const coord = fc.oneof(
  { weight: 12, arbitrary: fc.integer({ min: -200, max: 200 }) },
  { weight: 2, arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity, 1e308, -1e308, Number.MAX_VALUE, Number.MIN_VALUE, -Number.MIN_VALUE) },
);
const point = fc.record({ x: coord, y: coord });
const sanePoint = fc.record({ x: fc.integer({ min: -200, max: 200 }), y: fc.integer({ min: -200, max: 200 }) });
const drag = fc.tuple(
  fc.nat({ max: VARIANTS.length - 1 }),
  fc.array(pick, { minLength: 1, maxLength: 5 }),
  sanePoint,
  fc.array(point, { minLength: 0, maxLength: 12 }),
  fc.constantFrom<'commit' | 'cancel'>('commit', 'commit', 'commit', 'cancel'),
  fc.nat({ max: 7 }),
).map(([v, ks, s, path, reason, h]) => new Drag(v, ks, s, path, reason, h));
const setup = fc.tuple(fc.nat(), pick, fc.option(pick, { nil: null }), fc.boolean(), pose).map(([w, k, o, f, p]) => new Setup(w, k, o, f, p));
const insert = fc.tuple(fc.constantFrom(0, 1), pick, fc.option(pick, { nil: null, freq: 2 }), fc.boolean(), pose)
  .map(([w, k, o, f, p]) => new Setup(w, k, o, f, p));
const commands = fc.commands([
  insert, insert, setup, drag, drag, drag, drag, drag,
  fc.nat({ max: IMMEDIATE.length - 1 }).map((k) => new Immediate(k)),
  fc.constant(new Undo()), fc.constant(new Redo()),
], { maxCommands: 80, size: 'max' });

describe('ongoing actions on a real scene, stateful property', () => {
  it('each gesture never throws, cancels without a trace, keeps locks and finiteness, and undoes exactly', () => {
    fc.assert(fc.property(fc.array(fc.tuple(startId, pose), { minLength: 3, maxLength: 6 }), commands, (start, cmds) => {
      const real: Real = { scene: makeScene() };
      real.scene.untracked(() => {
        for (const [id, p] of start) {
          const own = id !== undefined && !real.scene.get(id as NodeId) ? id : real.scene.mintId();
          real.scene.add({ id: own as NodeId, kind: 'mark', layer: 'main', pose: p, data: {} });
        }
      });
      const model: Model = { states: [snap(real.scene)], cursor: 0 };
      fc.modelRun(() => ({ model, real }), cmds);
      while (real.scene.canUndo()) real.scene.undo();
      expect(snap(real.scene)).toEqual(model.states[0]);
    }), runs(N));
    for (const what of [...VARIANTS.filter((v) => v.name !== 'marquee').map((v) => v.name), 'beside a lock', 'past a wild point', 'a prototype-named id', 'a degenerate box', 'immediate', 'Undo', 'Redo']) {
      expect(seen.get(what), `${what} ran ${seen.dump()}`).toBeGreaterThan(runs(N).numRuns / 40);
    }
  }, timeoutFor(N, 60));
});
