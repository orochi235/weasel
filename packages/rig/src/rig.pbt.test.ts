/**
 * Stateful test of the bone and weight tools' actions on a real scene: bones drawn, joints moved, picked,
 * removed, and cleared, weights dabbed and stroked, and undo and redo, against a plain model of the joint
 * tree. Joints sit on whole pixels and every bind is a translation, so positions compare exactly. Each step
 * checks the tree (in order, every parent before its children), the active joint, the history depth, and
 * that every weight is finite, in 0..1, and each point sums to 1 or to nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { createScene, placeSkeleton, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { jointPositions, type Skeleton, type Skin } from '@weasel-js/animator';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import { createBoneActions } from './bone/boneActions';
import { placedRig } from './bone/placedRig';
import { createRigEditState, type RigEditState } from './bone/rigEditState';
import { createWeightActions } from './weight/weightActions';
import { runs, tally, timeoutFor } from './pbt.fixture';

type Data = { skeleton?: Skeleton; skin?: Skin; path?: Path };

const REACH = 10;
const BOX = { x: 40, y: 30, width: 200, height: 100 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const deps = { view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
/** The sleeve's points, which the weights index. */
const POINTS = [{ x: 60, y: 60 }, { x: 140, y: 60 }, { x: 220, y: 60 }, { x: 140, y: 100 }];

interface MJoint { name: string; parent: string | null; x: number; y: number }
interface Doc { joints: MJoint[]; skin: Skin }
interface Model { doc: Doc; past: Doc[]; future: Doc[]; active: string | null }
interface Real {
  scene: Scene<Data, 'main', RectPose>;
  rig: NodeId;
  sleeve: NodeId;
  state: RigEditState;
  actions: Map<string, Action>;
  shown: Skeleton | null;
}

const seen = tally();

const ctx = (x: number, y: number, from = { x, y }, alt = false): InvocationCtx => ({
  world: { x, y }, screen: { x, y }, modifiers: { ...MODS, alt }, deps,
  drag: { start: from, current: { x, y }, delta: { x: x - from.x, y: y - from.y } },
});

function makeReal(skin: Skin): Real {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const rig = scene.add({ kind: 'group', layer: 'main', pose: { ...BOX }, data: {} });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', parent: rig, pose: { x: 60, y: 60, width: 160, height: 40 },
    data: { path: polygonFromPoints(POINTS), skin },
  });
  scene.history.clear();
  const state = createRigEditState();
  const real = { scene, rig, sleeve, state, shown: null } as Real;
  const placed = () => placedRig(scene, rig);
  const bone = createBoneActions({
    scene: () => scene as never, placed, state, reachPx: () => REACH,
    show: (s) => { real.shown = s; }, shown: () => real.shown,
  });
  const weight = createWeightActions({
    scene: () => scene as never, placed, state, reachPx: () => REACH,
    painted: state.painted, paint: (next) => state.paint(next),
  });
  real.actions = new Map([...bone, ...weight].map((a) => [a.id, a]));
  return real;
}

const enabled = (r: Real, id: string): boolean => {
  const a = r.actions.get(id)!;
  return !a.enabled || a.enabled(deps) === true;
};

function runImmediate(r: Real, id: string, params?: Record<string, unknown>): void {
  const inv = r.actions.get(id)!.invoker;
  if (inv?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
  inv.run(deps, params);
}

function startOngoing(r: Real, id: string, at: InvocationCtx) {
  const inv = r.actions.get(id)!.invoker;
  if (inv?.timing !== 'ongoing') throw new Error(`${id} is not ongoing`);
  return inv.start(at, undefined);
}

/** The joints as the document holds them, in the scene's space. */
function realJoints(r: Real): MJoint[] {
  const node = r.scene.get(r.rig)!;
  const skeleton = node.data.skeleton;
  if (!skeleton) return [];
  const placed = placeSkeleton(skeleton, node.pose);
  const at = jointPositions(placed);
  return placed.joints.map((j) => ({ name: j.name, parent: j.parent, x: at.get(j.name)!.x, y: at.get(j.name)!.y }));
}

const realSkin = (r: Real): Skin => r.scene.get(r.sleeve)!.data.skin ?? {};

/** Model hit test: the nearest joint within reach, the later one on a tie, as `jointAt` reads it. */
function hitOf(joints: readonly MJoint[], x: number, y: number): string | null {
  let best: string | null = null;
  let bestD = REACH;
  for (const j of joints) {
    const d = Math.hypot(j.x - x, j.y - y);
    if (d <= bestD) { best = j.name; bestD = d; }
  }
  return best;
}

const validActive = (m: Model): string | null => (m.active !== null && m.doc.joints.some((j) => j.name === m.active) ? m.active : null);

function freeName(joints: readonly MJoint[]): string {
  const taken = new Set(joints.map((j) => j.name));
  let name = 'joint';
  for (let n = 2; taken.has(name); n++) name = `joint${n}`;
  return name;
}

function subtree(joints: readonly MJoint[], root: string): Set<string> {
  const gone = new Set([root]);
  for (const j of joints) if (j.parent !== null && gone.has(j.parent)) gone.add(j.name);
  return gone;
}

const sameDoc = (a: Doc, b: Doc): boolean => JSON.stringify(a) === JSON.stringify(b);

const sumAt = (skin: Skin, i: number): number => Object.values(skin).reduce((t, w) => t + (w[i] ?? 0), 0);

/** Each point a brush changed sums to 1 after it, or weighs nothing. */
function checkPainted(before: Skin, after: Skin): void {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (let i = 0; i < POINTS.length; i++) {
    if ([...names].every((n) => (before[n]?.[i] ?? 0) === (after[n]?.[i] ?? 0))) continue;
    const sum = sumAt(after, i);
    if (sum !== 0) expect(sum).toBeCloseTo(1, 9);
    seen.count('painted point');
  }
}

/** Record `next` as the document, one undo step, unless it changes nothing. */
function commit(m: Model, next: Doc): void {
  if (sameDoc(next, m.doc)) { seen.count('no-op edit'); return; }
  m.past.push(m.doc);
  m.future = [];
  m.doc = next;
}

function check(m: Model, r: Real): void {
  const joints = realJoints(r);
  expect(joints).toEqual(m.doc.joints);
  const names = new Set<string>();
  for (const j of joints) {
    expect(names.has(j.name)).toBe(false);
    if (j.parent !== null) expect(names.has(j.parent)).toBe(true);
    names.add(j.name);
  }
  expect(realSkin(r)).toEqual(m.doc.skin);
  const skin = realSkin(r);
  for (const name in skin) {
    expect(skin[name]).toHaveLength(POINTS.length);
    for (const w of skin[name]) { expect(Number.isFinite(w)).toBe(true); expect(w).toBeGreaterThanOrEqual(0); expect(w).toBeLessThanOrEqual(1); }
  }
  expect(r.state.active()).toBe(m.active);
  expect(r.scene.historyIndex()).toBe(m.past.length);
  expect(r.state.painted().size).toBe(0);
  expect(r.shown).toBeNull();
}

type Point = { x: number; y: number } | { joint: number; dx: number; dy: number };
const coord = fc.integer({ min: 0, max: 300 });
const point: fc.Arbitrary<Point> = fc.oneof(
  fc.record({ x: coord, y: coord }),
  fc.record({ joint: fc.nat(), dx: fc.integer({ min: -12, max: 12 }), dy: fc.integer({ min: -12, max: 12 }) }),
  fc.record({ joint: fc.nat(), dx: fc.integer({ min: -4, max: 4 }), dy: fc.integer({ min: -4, max: 4 }) }),
);
/** A point as given, or near the joint it names, so presses land on joints often. */
function resolve(m: Model, p: Point): { x: number; y: number } {
  if ('x' in p) return p;
  const j = m.doc.joints[p.joint % Math.max(1, m.doc.joints.length)];
  return j ? { x: j.x + p.dx, y: j.y + p.dy } : { x: 150 + p.dx, y: 80 + p.dy };
}

class Drag implements fc.Command<Model, Real> {
  constructor(readonly from: Point, readonly to: Point, readonly cancel: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const p = resolve(m, this.from);
    const q = resolve(m, this.to);
    const handle = startOngoing(r, 'bone.drag', ctx(p.x, p.y));
    handle.onMove?.(ctx(q.x, q.y, p));
    handle.onEnd?.({ ...ctx(q.x, q.y), deps: {} as ActionDeps }, this.cancel ? 'cancel' : 'commit');
    if (this.cancel) { seen.count('drag cancel'); check(m, r); return; }
    const hit = hitOf(m.doc.joints, p.x, p.y);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    let joints: MJoint[];
    let joint: string;
    if (hit !== null) {
      const moving = subtree(m.doc.joints, hit);
      joints = m.doc.joints.map((j) => (moving.has(j.name) ? { ...j, x: j.x + dx, y: j.y + dy } : j));
      joint = hit;
      seen.count('move joint');
    } else {
      joints = [...m.doc.joints];
      let parent = validActive(m);
      if (parent === null) {
        parent = freeName(joints);
        joints.push({ name: parent, parent: null, x: p.x, y: p.y });
        seen.count('new root');
      }
      joint = freeName(joints);
      joints.push({ name: joint, parent, x: q.x, y: q.y });
      seen.count('add bone');
    }
    m.active = joint;
    commit(m, { ...m.doc, joints });
    check(m, r);
  }
  toString = () => `drag(${JSON.stringify(this.from)} → ${JSON.stringify(this.to)}${this.cancel ? ', cancel' : ''})`;
}

class Pick implements fc.Command<Model, Real> {
  constructor(readonly at: Point) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const p = resolve(m, this.at);
    if (!enabled(r, 'bone.pick')) return;
    runImmediate(r, 'bone.pick', { press: p });
    m.active = hitOf(m.doc.joints, p.x, p.y);
    if (m.active !== null) seen.count('pick');
    check(m, r);
  }
  toString = () => `pick(${JSON.stringify(this.at)})`;
}

class Remove implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    const active = validActive(m);
    expect(enabled(r, 'bone.remove')).toBe(active !== null);
    if (active === null) return;
    runImmediate(r, 'bone.remove');
    const gone = subtree(m.doc.joints, active);
    const skin: Record<string, readonly number[]> = {};
    for (const name in m.doc.skin) if (!gone.has(name)) skin[name] = m.doc.skin[name];
    m.active = m.doc.joints.find((j) => j.name === active)!.parent;
    commit(m, { joints: m.doc.joints.filter((j) => !gone.has(j.name)), skin });
    seen.count('remove');
    check(m, r);
  }
  toString = () => 'remove';
}

class Clear implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    if (!enabled(r, 'bone.clear')) { expect(validActive(m)).toBeNull(); return; }
    runImmediate(r, 'bone.clear');
    m.active = null;
    check(m, r);
  }
  toString = () => 'clear';
}

class Dab implements fc.Command<Model, Real> {
  constructor(readonly at: Point, readonly alt: boolean, readonly radiusPx: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const p = resolve(m, this.at);
    runImmediate(r, 'weight.click', { press: p, mods: { alt: this.alt }, radiusPx: this.radiusPx });
    const hit = hitOf(m.doc.joints, p.x, p.y);
    if (hit !== null) {
      m.active = hit;
    } else if (validActive(m) !== null) {
      checkPainted(m.doc.skin, realSkin(r));
      commit(m, { ...m.doc, skin: realSkin(r) });
      seen.count('dab');
    }
    check(m, r);
  }
  toString = () => `dab(${JSON.stringify(this.at)}, alt ${this.alt}, ${this.radiusPx}px)`;
}

class Stroke implements fc.Command<Model, Real> {
  constructor(readonly at: Point[], readonly alt: boolean, readonly cancel: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const active = validActive(m);
    expect(enabled(r, 'weight.paint')).toBe(active !== null);
    if (active === null) return;
    const pts = this.at.map((p) => resolve(m, p));
    const handle = startOngoing(r, 'weight.paint', ctx(pts[0]!.x, pts[0]!.y, pts[0], this.alt));
    for (const q of pts.slice(1)) handle.onMove?.(ctx(q.x, q.y, pts[0], this.alt));
    handle.onEnd?.({ ...ctx(0, 0), deps: {} as ActionDeps }, this.cancel ? 'cancel' : 'commit');
    if (!this.cancel) {
      checkPainted(m.doc.skin, realSkin(r));
      commit(m, { ...m.doc, skin: realSkin(r) });
      seen.count('stroke');
    }
    check(m, r);
  }
  toString = () => `stroke(${JSON.stringify(this.at)}, alt ${this.alt}${this.cancel ? ', cancel' : ''})`;
}

class Undo implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    expect(r.scene.undo()).toBe(m.past.length > 0);
    if (m.past.length > 0) {
      m.future.push(m.doc);
      m.doc = m.past.pop()!;
      seen.count('undo');
    }
    check(m, r);
  }
  toString = () => 'undo';
}

class Redo implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    expect(r.scene.redo()).toBe(m.future.length > 0);
    if (m.future.length > 0) {
      m.past.push(m.doc);
      m.doc = m.future.pop()!;
      seen.count('redo');
    }
    check(m, r);
  }
  toString = () => 'redo';
}

/** A skin over the sleeve's points with each point summing to 1, or weighing nothing. */
const skinArb: fc.Arbitrary<Skin> = fc.array(fc.tuple(fc.nat({ max: 4 }), fc.nat({ max: 4 })), { minLength: POINTS.length, maxLength: POINTS.length })
  .map((pts) => {
    const out: Record<string, number[]> = { joint: [], joint2: [] };
    for (const [a, b] of pts) {
      const t = a + b;
      out.joint!.push(t === 0 ? 0 : a / t);
      out.joint2!.push(t === 0 ? 0 : b / t);
    }
    for (const name of Object.keys(out)) if (!out[name]!.some((w) => w > 0)) delete out[name];
    return out;
  });

const commands = [
  fc.tuple(point, point, fc.boolean()).map(([a, b, c]) => new Drag(a, b, c)),
  fc.tuple(point, point).map(([a, b]) => new Drag(a, b, false)),
  point.map((p) => new Pick(p)),
  fc.constant(new Remove()),
  fc.constant(new Clear()),
  fc.tuple(point, fc.boolean(), fc.constantFrom(8, 24, 60, 200)).map(([p, alt, rad]) => new Dab(p, alt, rad)),
  fc.tuple(fc.array(point, { minLength: 1, maxLength: 4 }), fc.boolean(), fc.boolean()).map(([ps, alt, c]) => new Stroke(ps, alt, c)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
];

describe('bone and weight actions, stateful', () => {
  it('edit the joint tree and the weights as a plain model does, and undo restores each step exactly', () => {
    fc.assert(fc.property(skinArb, fc.commands(commands, { maxCommands: 40, size: '+1' }), (skin, cmds) => {
      const real = makeReal(skin);
      const model: Model = { doc: { joints: [], skin }, past: [], future: [], active: null };
      fc.modelRun(() => ({ model, real }), cmds);
    }), runs(120));
    for (const what of ['add bone', 'new root', 'move joint', 'remove', 'pick', 'undo', 'drag cancel', 'no-op edit']) seen.atLeast(what, 30);
    for (const what of ['redo', 'dab', 'stroke', 'painted point']) seen.atLeast(what, 12);
  }, timeoutFor(120, 30));
});
