/**
 * Stateful property test: the kit's immediate edit actions (align, distribute, nudge, flip, reorder, duplicate,
 * delete, group, ungroup) run on a real scene among lock, hide, and reparent edits, undo, and redo. After every
 * action: it never throws, it records one entry exactly when its `enabled` says yes (the 2026-11-10
 * `NotApplicable` ruling) and changes nothing otherwise, no locked node moves, and undo and redo land on the
 * states the model holds.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';
import { createInsertOp } from 'core/ops/create';
import { createReparentOp } from 'core/ops/reparent';
import { createSetHiddenOp, createSetLockedOp } from 'core/ops/nodeFlags';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import {
  alignLeftAction, alignRightAction, alignTopAction, alignBottomAction, alignCenterXAction, alignCenterYAction,
} from './align/action';
import { distributeHorizontalAction, distributeVerticalAction } from './distribute/action';
import { nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction } from './defaults/nudge';
import { reorderForwardAction, reorderBackwardAction } from './defaults/reorder';
import { flipAction } from './flip/action';
import { duplicateAction } from './defaults/duplicate';
import { deleteAction } from './defaults/delete';
import { groupAction, ungroupAction } from './defaults/group';
import { scenePoseFrame } from './poseFrame';
import { uncarried } from './selectionSubtree';
import { drawnBoxes } from './drawnBoxes';
import { withoutPageStructure } from 'core/scene/nodeGates';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { depsOf, makeScene, rectPose, runs, tally, timeoutFor, type TestScene } from './pbt.fixture';

interface Real { scene: TestScene }
interface Model { states: unknown[]; cursor: number }

const N = 100;
const seen = tally();

const snap = (scene: TestScene): unknown => JSON.parse(JSON.stringify(scene.toJSON()));
const ids = (scene: TestScene): NodeId[] => [...scene.nodes.keys()].sort();
const groups = (scene: TestScene): NodeId[] => ids(scene).filter((id) => scene.get(id)!.kind === 'group');
const pickFrom = <T,>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);

/** Each locked node's stored pose and slot: what no action may change. */
const placeOf = (scene: TestScene, id: NodeId): string => {
  const node = scene.get(id)!;
  return JSON.stringify({ pose: node.pose, parent: node.parent ?? null });
};
function lockedState(scene: TestScene): Map<NodeId, string> {
  const out = new Map<NodeId, string>();
  for (const id of scene.nodes.keys()) if (scene.isLocked(id)) out.set(id, placeOf(scene, id));
  return out;
}

/** Record what an edit did: one new entry, or nothing changed at all. Returns whether it recorded. */
function settle(m: Model, r: Real): boolean {
  const index = r.scene.historyIndex();
  if (index === m.cursor + 1) {
    m.states.splice(m.cursor + 1);
    m.states.push(snap(r.scene));
    m.cursor++;
    return true;
  }
  expect(index, 'an edit records one entry or none').toBe(m.cursor);
  expect(snap(r.scene), 'an edit that recorded nothing changed nothing').toEqual(m.states[m.cursor]);
  return false;
}

/** The world box of each member an align or distribute of the selection moves, by id. */
function memberBoxes(scene: TestScene): Map<NodeId, Bounds> {
  const frame = scenePoseFrame(scene as never);
  const members = uncarried(frame, withoutPageStructure(scene as never, [...scene.getSelection()]));
  const boxes = drawnBoxes(depsOf(scene), frame);
  return new Map(members.map((id) => [id, boxes.aabb(id, frame.world(id))]));
}

const near = (a: number, b: number, what: string): void => {
  expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1e-9 * Math.max(1000, Math.abs(a), Math.abs(b)));
};

/** Whether the boxes a gaps distribute spaces fit between its ends without overlapping. Where they do not, the
 *  gaps it leaves are negative, and which boxes are its ends is open (docs/unruled.md, 2026-11-10). */
function gapsFit(name: string, boxes: Map<NodeId, Bounds>): boolean {
  if (!name.endsWith('gaps')) return true;
  const x = name.startsWith('distribute.x');
  const lo = (b: Bounds) => (x ? b.x : b.y);
  const size = (b: Bounds) => (x ? b.width : b.height);
  const sorted = [...boxes.values()].sort((p, q) => lo(p) - lo(q));
  const span = lo(sorted.at(-1)!) + size(sorted.at(-1)!) - lo(sorted[0]!);
  return sorted.reduce((sum, b) => sum + size(b), 0) <= span;
}

type Feature = (b: Bounds) => number;
const ALIGN_FEATURE: Record<string, Feature> = {
  'align.left': (b) => b.x, 'align.right': (b) => b.x + b.width, 'align.centerX': (b) => b.x + b.width / 2,
  'align.top': (b) => b.y, 'align.bottom': (b) => b.y + b.height, 'align.centerY': (b) => b.y + b.height / 2,
};

/** What each action must have left true of the members it moved, given their boxes before it ran. */
function checkLaw(name: string, before: Map<NodeId, Bounds>, after: Map<NodeId, Bounds>): void {
  const feature = ALIGN_FEATURE[name];
  if (feature) {
    // Aligned to the union: every member's edge sits on the union's edge, which is where the outermost one was.
    const want = name.endsWith('left') || name.endsWith('top')
      ? Math.min(...[...before.values()].map(feature))
      : name.endsWith('right') || name.endsWith('bottom') ? Math.max(...[...before.values()].map(feature)) : null;
    const values = [...after.values()].map(feature);
    for (const v of values) near(v, want ?? values[0]!, name);
    for (const [id, b] of after) {
      near(b.width, before.get(id)!.width, `${name} keeps ${id}'s width`);
      near(b.height, before.get(id)!.height, `${name} keeps ${id}'s height`);
    }
    return;
  }
  if (name.startsWith('distribute.')) {
    const x = name.startsWith('distribute.x');
    const lo = (b: Bounds) => (x ? b.x : b.y);
    const size = (b: Bounds) => (x ? b.width : b.height);
    const across = (b: Bounds) => (x ? b.y : b.x);
    const scale = Math.max(1000, ...[...before.values()].map((b) => Math.abs(lo(b)) + size(b)));
    for (const [id, b] of after) near(across(b), across(before.get(id)!), `${name} keeps ${id} on the other axis`);
    if (name.endsWith('centers')) {
      const c = [...after.values()].map((b) => lo(b) + size(b) / 2).sort((p, q) => p - q);
      const step = (c.at(-1)! - c[0]!) / (c.length - 1);
      c.forEach((v, i) => expect(Math.abs(v - (c[0]! + step * i)), `${name} spaces centers evenly ${c}`).toBeLessThanOrEqual(1e-9 * scale));
      // The two outermost centers stay put.
      const was = [...before.values()].map((b) => lo(b) + size(b) / 2);
      near(c[0]!, Math.min(...was), `${name} keeps the first center`);
      near(c.at(-1)!, Math.max(...was), `${name} keeps the last center`);
    } else if (gapsFit(name, before)) {
      const sorted = [...after.values()].sort((p, q) => lo(p) - lo(q));
      const gaps = sorted.slice(1).map((b, i) => lo(b) - (lo(sorted[i]!) + size(sorted[i]!)));
      for (const g of gaps) expect(Math.abs(g - gaps[0]!), `${name} leaves equal gaps ${gaps}`).toBeLessThanOrEqual(1e-9 * scale);
    }
    return;
  }
  if (name.startsWith('nudge.')) {
    const ds = [...after].map(([id, b]) => [b.x - before.get(id)!.x, b.y - before.get(id)!.y]);
    for (const d of ds) { near(d[0]!, ds[0]![0]!, `${name} moves all alike`); near(d[1]!, ds[0]![1]!, `${name} moves all alike`); }
  }
}

/** An action, the params of one of its variants, and a name for the tally. */
interface Variant { name: string; action: Action; params?: Record<string, unknown> }

const VARIANTS: Variant[] = [
  { name: 'align.left', action: alignLeftAction },
  { name: 'align.right', action: alignRightAction },
  { name: 'align.top', action: alignTopAction },
  { name: 'align.bottom', action: alignBottomAction },
  { name: 'align.centerX', action: alignCenterXAction },
  { name: 'align.centerY', action: alignCenterYAction },
  { name: 'distribute.x.centers', action: distributeHorizontalAction, params: { mode: 'centers' } },
  { name: 'distribute.x.gaps', action: distributeHorizontalAction, params: { mode: 'gaps' } },
  { name: 'distribute.y.centers', action: distributeVerticalAction, params: { mode: 'centers' } },
  { name: 'distribute.y.gaps', action: distributeVerticalAction, params: { mode: 'gaps' } },
  { name: 'nudge.up', action: nudgeUpAction, params: { magnitude: 'small' } },
  { name: 'nudge.down', action: nudgeDownAction, params: { magnitude: 'big' } },
  { name: 'nudge.left', action: nudgeLeftAction, params: { magnitude: 'small' } },
  { name: 'nudge.right', action: nudgeRightAction, params: { magnitude: 'big' } },
  { name: 'flip.x.each', action: flipAction, params: { axis: 'x' } },
  { name: 'flip.y.union', action: flipAction, params: { axis: 'y', pivot: 'union' } },
  { name: 'reorder.forward', action: reorderForwardAction, params: { distance: 'adjacent' } },
  { name: 'reorder.front', action: reorderForwardAction, params: { distance: 'extreme' } },
  { name: 'reorder.backward', action: reorderBackwardAction, params: { distance: 'adjacent' } },
  { name: 'reorder.back', action: reorderBackwardAction, params: { distance: 'extreme' } },
  { name: 'duplicate', action: duplicateAction },
  { name: 'delete', action: deleteAction },
  { name: 'group', action: groupAction },
  { name: 'ungroup', action: ungroupAction },
];

class RunAction implements fc.Command<Model, Real> {
  constructor(readonly variant: number, readonly picks: number[]) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const v = VARIANTS[this.variant % VARIANTS.length]!;
    const all = ids(r.scene);
    // The first pick says where a run of distinct ids starts, each later one how far past the last it skips.
    const chosen: NodeId[] = [];
    let at = this.picks[0] ?? 0;
    for (const skip of this.picks) {
      const id = pickFrom(all, at);
      if (id !== undefined && !chosen.includes(id)) chosen.push(id);
      at += 1 + (skip % 3);
    }
    r.scene.setSelection(chosen.filter((id) => !r.scene.isLocked(id)));
    const deps = depsOf(r.scene);
    const enabled = v.action.enabled ? v.action.enabled(deps, undefined, undefined, v.params) : true;
    const locked = lockedState(r.scene);
    const before = memberBoxes(r.scene);
    (v.action.invoker as ImmediateInvoker).run(deps, v.params as never);
    const recorded = settle(m, r);
    expect(recorded, `${v.name} recorded an entry exactly when enabled (${String(enabled)})`).toBe(enabled === true);
    if (recorded && /^(align|distribute|nudge)\./.test(v.name)) {
      checkLaw(v.name, before, memberBoxes(r.scene));
      // Align and distribute are idempotent: once run, the same selection has nothing left to do.
      if (!v.name.startsWith('nudge.') && gapsFit(v.name, before)) {
        const again = v.action.enabled!(depsOf(r.scene), undefined, undefined, v.params);
        expect(again, `${v.name} run again on what it left`).not.toBe(true);
      }
    }
    for (const [id, was] of locked) {
      if (!r.scene.get(id)) continue;
      expect(placeOf(r.scene, id), `${v.name} left locked ${id} where it was`).toBe(was);
    }
    seen.count(recorded ? v.name : `off:${v.name}:${String(enabled)}`);
    if (recorded && locked.size > 0) seen.count('beside a lock');
    if (enabled === 'locked') seen.count('refused for a lock');
  }
  toString(): string { return `Run(${VARIANTS[this.variant % VARIANTS.length]!.name}, [${this.picks.join(',')}])`; }
}

/** A scene edit that is not an action under test: insert, lock, hide, reparent. */
class Setup implements fc.Command<Model, Real> {
  constructor(readonly which: number, readonly pick: number, readonly other: number | null, readonly flag: boolean, readonly pose: RectPose) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const all = ids(r.scene);
    const id = pickFrom(all, this.pick);
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
  toString(): string { return `Setup(${['insert', this.flag ? 'insertGroup' : 'insert', 'lock', 'hide', 'reparent'][this.which % 5]}, ${this.pick}, ${this.other}, ${this.flag}, ${JSON.stringify(this.pose)})`; }
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
/** A rect pose, upright or turned: a turned one is what a flip in place changes. */
const pose = fc.tuple(rectPose, fc.option(fc.constantFrom(Math.PI / 2, Math.PI / 6, -Math.PI / 4), { nil: undefined, freq: 3 }))
  .map(([p, rotation]) => (rotation === undefined ? p : { ...p, rotation }));
const insert = fc.tuple(fc.constantFrom(0, 1), pick, fc.option(pick, { nil: null, freq: 2 }), fc.boolean(), pose)
  .map(([w, k, o, f, p]) => new Setup(w, k, o, f, p));
const selection = fc.oneof(
  { weight: 1, arbitrary: fc.constant([]) },
  { weight: 3, arbitrary: fc.array(pick, { minLength: 1, maxLength: 2 }) },
  { weight: 6, arbitrary: fc.array(pick, { minLength: 3, maxLength: 6 }) },
);
const lock = pick.map((k) => new Setup(2, k, null, true, { x: 0, y: 0, width: 1, height: 1 }));
const action = fc.tuple(fc.nat({ max: VARIANTS.length - 1 }), selection).map(([v, ks]) => new RunAction(v, ks));
const commands = fc.commands([
  insert, insert, insert, insert,
  fc.tuple(fc.nat(), pick, fc.option(pick, { nil: null }), fc.boolean(), pose).map(([w, k, o, f, p]) => new Setup(w, k, o, f, p)),
  lock,
  action, action, action, action, action, action,
  fc.constant(new Undo()),
  fc.constant(new Redo()),
], { maxCommands: 60, size: 'max' });

describe('immediate edit actions on a real scene, stateful property', () => {
  it('each runs exactly when enabled, never throws, never moves a locked node, and undoes exactly', () => {
    fc.assert(fc.property(fc.array(pose, { minLength: 3, maxLength: 6 }), commands, (start, cmds) => {
      const real: Real = { scene: makeScene() };
      // A few marks to start from, so most runs reach the actions that need three.
      real.scene.untracked(() => {
        for (const p of start) real.scene.add({ id: real.scene.mintId(), kind: 'mark', layer: 'main', pose: p, data: {} });
      });
      const model: Model = { states: [snap(real.scene)], cursor: 0 };
      fc.modelRun(() => ({ model, real }), cmds);
      while (real.scene.canUndo()) real.scene.undo();
      expect(snap(real.scene)).toEqual(model.states[0]);
    }), runs(N));
    for (const what of [...VARIANTS.map((v) => v.name), 'beside a lock', 'refused for a lock']) {
      expect(seen.get(what), `${what} ran ${seen.dump()}`).toBeGreaterThan(runs(N).numRuns / 40);
    }
  }, timeoutFor(N, 30));
});
