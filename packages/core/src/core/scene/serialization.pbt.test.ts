/**
 * Property tests for a scene's snapshot: any scene built by edits writes a snapshot that reads back to itself,
 * through JSON text and through `loadState`; and a snapshot broken in any of the ways a hand edit or a bad file
 * breaks one is either refused with an `Error` the scene throws on purpose, leaving a `loadState` target as it was,
 * or read into a well-formed tree.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createScene, sceneFromJSON } from './scene';
import { isSerializedScene } from './serialization';
import { replaceDoc } from './docValues';
import type { NodeId, Scene } from './types';
import { createPageRun } from '../pages/pageNodes';

type Pose = { x: number; y: number; width: number; height: number };
type S = Scene<Record<string, unknown>, 'a' | 'b', Pose>;

const N = 100;
const T = timeoutFor(N, 30);
const LAYERS = [{ id: 'a' as const }, { id: 'b' as const }];

const make = (): S => createScene<Record<string, unknown>, 'a' | 'b', Pose>({ systemLayers: LAYERS }) as S;
const json = (scene: S): unknown => JSON.parse(JSON.stringify(scene.toJSON()));

/** The scene's tree is a forest: each node once, under a parent that lists it, and every id unique. */
function checkTree(scene: S): void {
  const seen = new Map<NodeId, number>();
  const visit = (id: NodeId, parent: NodeId | null, depth: number): void => {
    expect(depth).toBeLessThan(200);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const node = scene.get(id);
    expect(node, `listed child ${id} is in the scene`).toBeDefined();
    expect(node!.parent ?? null).toBe(parent);
    for (const kid of scene.childrenOf(id)) visit(kid, id, depth + 1);
  };
  for (const root of scene.roots) visit(root, null, 0);
  for (const id of scene.nodes.keys()) expect(seen.get(id), `${id} sits once in the tree`).toBe(1);
}

const dataKey = fc.constantFrom('n', 'label', '__proto__', 'constructor', 'toString');
const step = fc.record({
  group: fc.boolean(),
  parent: fc.option(fc.nat({ max: 20 }), { nil: null }),
  layer: fc.constantFrom('a', 'b'),
  pose: fc.record({ x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }), width: fc.integer({ min: 0, max: 99 }), height: fc.integer({ min: 0, max: 99 }) }),
  data: fc.array(fc.tuple(dataKey, fc.oneof(fc.integer(), fc.string({ maxLength: 3 }), fc.constant(null))), { maxLength: 3 }),
  flags: fc.record({ hidden: fc.boolean(), locked: fc.boolean(), pickable: fc.boolean() }),
  depends: fc.option(fc.oneof(fc.constant('children' as const), fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 2 })), { nil: undefined, freq: 3 }),
});

function own(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  return o;
}

/** A scene made by adding nodes one at a time, some under groups, some flagged, some deriving from others. */
const sceneArb = fc.record({ steps: fc.array(step, { maxLength: 14 }), paged: fc.boolean(), doc: fc.boolean() }).map(({ steps, paged, doc }) => {
  const scene = make();
  if (paged) createPageRun(scene, [{ id: 'p1', width: 100, height: 100 }, { id: 'p2', width: 50, height: 80, name: 'Two' }], { gap: 5 });
  for (const s of steps) {
    const ids = [...scene.nodes.keys()];
    const groups = ids.filter((id) => scene.get(id)!.kind === 'group');
    const parent = s.parent === null || groups.length === 0 ? null : groups[s.parent % groups.length]!;
    const layer = parent === null ? s.layer : scene.get(parent)!.layer;
    const dependsOn = s.depends === undefined ? undefined
      : s.depends === 'children' ? (s.group ? 'children' as const : undefined)
      : ids.length === 0 ? undefined : [...new Set(s.depends.map((k) => ids[k % ids.length]!))];
    try {
      scene.add({
        kind: s.group ? 'group' : 'mark', layer, pose: s.pose, data: own(s.data),
        ...(parent === null ? {} : { parent }),
        ...(s.flags.hidden ? { hidden: true } : {}),
        ...(s.flags.locked ? { locked: true } : {}),
        ...(s.flags.pickable ? {} : { pickable: false }),
        ...(dependsOn === undefined ? {} : { dependsOn }),
      });
    } catch {
      // A locked parent refuses children; the scene stays as it was.
    }
  }
  if (doc) {
    scene.doc.set('test:doc', own([['a', [1, 2]], ['__proto__', 'own']]));
    scene.doc.set('toString', 1);
  }
  return scene;
});

describe('scene snapshot round trip', () => {
  it('a snapshot read back, through JSON text, writes the same snapshot and the same tree', () => {
    const t = tally();
    fc.assert(fc.property(sceneArb, (scene) => {
      const snap = json(scene);
      expect(isSerializedScene(snap)).toBe(true);
      const back = sceneFromJSON(snap as never) as S;
      expect(json(back)).toEqual(snap);
      checkTree(back);
      expect([...back.nodes.keys()].sort()).toEqual([...scene.nodes.keys()].sort());
      for (const id of scene.nodes.keys()) {
        expect(back.childrenOf(id)).toEqual(scene.childrenOf(id));
        expect(Object.keys(back.get(id)!.data ?? {}).sort()).toEqual(Object.keys(scene.get(id)!.data ?? {}).sort());
      }
      expect(back.roots).toEqual(scene.roots);
      if (JSON.stringify(snap).includes('"__proto__"')) t.count('prototype key');
      if (scene.nodes.size > 6) t.count('big');
      if ([...scene.nodes.values()].some((n) => n.dependsOn !== undefined)) t.count('depends');
    }), runs(N));
    t.atLeast('prototype key', N / 10);
    t.atLeast('big', N / 10);
    t.atLeast('depends', N / 10);
  }, T);

  it('loadState puts a snapshot in place of whatever the scene held, history cleared, selection kept to what survives', () => {
    fc.assert(fc.property(sceneArb, sceneArb, (from, into) => {
      const snap = json(from);
      const before = [...into.nodes.keys()];
      into.setSelection(before.slice(0, 2) as NodeId[]);
      into.loadState(snap as never);
      expect(json(into)).toEqual(snap);
      expect(into.canUndo()).toBe(false);
      checkTree(into);
      for (const id of into.getSelection()) expect(into.get(id)).toBeDefined();
    }), runs(N));
  }, T);
});

describe('document values', () => {
  const docKey = fc.constantFrom('core:x', 'diagram:theme', '__proto__', 'constructor', 'toString', 'valueOf');
  const values = fc.uniqueArray(fc.tuple(docKey, fc.oneof(fc.integer(), fc.string({ maxLength: 3 }), fc.array(fc.integer(), { maxLength: 2 }))), { maxLength: 4, selector: ([k]) => k });

  it('replaceDoc leaves exactly the keys it is given, as one undo step that restores the old ones', () => {
    const t = tally();
    fc.assert(fc.property(values, values, (a, b) => {
      const scene = make();
      scene.batch('a', () => replaceDoc(scene, own(a)));
      const was = json(scene);
      const at = scene.historyIndex();
      scene.batch('b', () => replaceDoc(scene, own(b)));
      expect([...scene.doc.keys()].sort()).toEqual(b.map(([k]) => k).sort());
      for (const [k, v] of b) expect(scene.doc.get(k)).toEqual(v);
      const changed = JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort());
      if (scene.historyIndex() > at) {
        scene.undo();
        expect(json(scene)).toEqual(was);
      }
      const back = sceneFromJSON(json(scene) as never) as S;
      expect(json(back)).toEqual(json(scene));
      if (changed && a.some(([k]) => ['constructor', 'toString', 'valueOf'].includes(k))) t.count('prototype key dropped');
    }), runs(N));
    t.atLeast('prototype key dropped', N / 10);
  }, T);
});

/** One way to break a snapshot. Each returns the broken copy. */
type Breaker = (snap: Record<string, any>, k: number) => unknown;
const at = <T>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);
const BREAKERS: Record<string, Breaker> = {
  version: (s, k) => ({ ...s, version: [0, 4, '3', null, undefined, 2.5][k % 6] }),
  nodesNotArray: (s, k) => ({ ...s, nodes: [null, {}, 'x', 3][k % 4] }),
  layersNotArray: (s, k) => ({ ...s, systemLayers: [null, {}, 'a', undefined][k % 4] }),
  noLayers: (s) => ({ ...s, systemLayers: [] }),
  badLayer: (s, k) => ({ ...s, systemLayers: [...s.systemLayers, [null, 3, {}, { id: 3 }][k % 4]] }),
  duplicateLayer: (s) => ({ ...s, systemLayers: [...s.systemLayers, s.systemLayers[0]] }),
  nodeNotObject: (s, k) => ({ ...s, nodes: [...s.nodes, [null, 3, 'n', []][k % 4]] }),
  duplicateId: (s, k) => ({ ...s, nodes: s.nodes.length === 0 ? s.nodes : [...s.nodes, at(s.nodes, k)] }),
  missingField: (s, k) => ({
    ...s,
    nodes: s.nodes.map((n: Record<string, unknown>, i: number) => {
      if (i !== k % Math.max(1, s.nodes.length)) return n;
      const { [['id', 'kind', 'layer', 'pose', 'data'][k % 5]!]: _gone, ...rest } = n;
      return rest;
    }),
  }),
  wrongType: (s, k) => ({
    ...s,
    nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i !== k % Math.max(1, s.nodes.length) ? n
      : { ...n, [['id', 'kind', 'layer', 'parent', 'dependsOn', 'pose', 'hidden'][k % 7]!]: [3, 'blob', 'nowhere', 7, 'x', null, 'yes'][(k >> 3) % 7] })),
  }),
  unknownParent: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, parent: 'ghost' } : n)) }),
  selfParent: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, parent: n.id } : n)) }),
  markParent: (s, k) => {
    const mark = s.nodes.find((n: Record<string, unknown>) => n.kind === 'mark');
    return mark ? { ...s, nodes: [...s.nodes, { id: `kid${k}`, kind: 'mark', layer: mark.layer, pose: { x: 0, y: 0, width: 1, height: 1 }, data: {}, parent: mark.id }] } : s;
  },
  cycle: (s, k) => {
    const nodes = s.nodes.map((n: Record<string, unknown>) => ({ ...n }));
    const a = at(nodes, k) as Record<string, unknown> | undefined;
    const b = at(nodes, k + 1) as Record<string, unknown> | undefined;
    if (a && b) { a.parent = b.id; b.parent = a.id; a.kind = 'group'; b.kind = 'group'; }
    return { ...s, nodes };
  },
  childFirst: (s) => ({ ...s, nodes: [...s.nodes].reverse() }),
  unknownLayer: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, layer: 'zz' } : n)) }),
  layerBelowParent: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) && n.parent ? { ...n, layer: n.layer === 'a' ? 'b' : 'a' } : n)) }),
  unknownDependency: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, dependsOn: ['ghost'] } : n)) }),
  selfDependency: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, dependsOn: [n.id] } : n)) }),
  unknownKey: (s, k) => ({ ...s, nodes: s.nodes.map((n: Record<string, unknown>, i: number) => (i === k % Math.max(1, s.nodes.length) ? { ...n, [['clipFromPoseKey', 'derivePoseKey', 'layoutKey', 'derivePathKey'][k % 4]!]: ['nope', 'toString', '__proto__', 'constructor'][(k >> 2) % 4] } : n)) }),
  docNotObject: (s, k) => ({ ...s, doc: [3, 'x', [], null][k % 4] }),
};

/** An error the scene raised itself, as against one the engine hit by reading a field that was not there. */
function expectOnPurpose(e: unknown, how: string): void {
  expect(e, `${how}: ${String(e)}`).toBeInstanceOf(Error);
  const accidental = [TypeError, RangeError, ReferenceError, SyntaxError].some((C) => e instanceof C);
  expect(accidental, `${how} throws on purpose, not by accident: ${String(e)}\n${(e as Error).stack?.split('\n').slice(1, 4).join('\n')}`).toBe(false);
}

describe('reading a broken snapshot', () => {
  it('is refused with a scene error, never a TypeError, and a refused loadState leaves the scene as it was', () => {
    const t = tally();
    fc.assert(fc.property(sceneArb, fc.constantFrom(...Object.keys(BREAKERS)), fc.nat(), sceneArb, (from, how, k, target) => {
      const broken = BREAKERS[how]!(json(from) as Record<string, any>, k);
      let read: S | null = null;
      try {
        read = sceneFromJSON(broken as never) as S;
      } catch (e) {
        expectOnPurpose(e, how);
        t.count(`refused:${how}`);
      }
      if (read) {
        t.count(`read:${how}`);
        checkTree(read);
        expect(json(sceneFromJSON(json(read) as never) as S)).toEqual(json(read));
      }
      const was = json(target);
      const index = target.historyIndex();
      try {
        target.loadState(broken as never);
        expect(read, `${how}: loadState agrees with sceneFromJSON`).not.toBeNull();
        checkTree(target);
      } catch (e) {
        expectOnPurpose(e, `${how} (loadState)`);
        expect(json(target), `${how}: a refused load keeps the document`).toEqual(was);
        expect(target.historyIndex()).toBe(index);
      }
    }), runs(N * 3));
    for (const how of Object.keys(BREAKERS)) {
      expect((t.seen.get(`refused:${how}`) ?? 0) + (t.seen.get(`read:${how}`) ?? 0), `${how} ran`).toBeGreaterThanOrEqual(3);
    }
    for (const how of ['version', 'nodesNotArray', 'layersNotArray', 'noLayers', 'badLayer', 'nodeNotObject', 'missingField', 'unknownParent', 'cycle', 'unknownLayer']) {
      t.atLeast(`refused:${how}`, 2);
    }
  }, T * 3);
});
