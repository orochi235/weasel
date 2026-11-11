/**
 * Stateful property test of an editor session saved and reloaded at any point: two scenes take the same edits, undos,
 * redos, and history jumps, and one of them is now and then written out the way `useSessionPersistence` writes it
 * (`serializeReplacer`) and rebuilt the way an editor boots (`nodeSpecsFromSnapshot`, `docFromSnapshot`, and the undo
 * stack revived and restored). After every step the two hold the same nodes, document values, and history, so an
 * undo after a reload puts back what it would have without one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId, createScene, defaultCommitAdapter, type NodeId, type Scene, type SerializedScene } from '@weasel-js/core';
import { docFromSnapshot, nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer } from './snapshot';
import { dataKey, dataValue, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 120;

type Pose = { x: number; y: number; width: number; height: number };
type Data = Record<string, unknown>;
type S = Scene<Data, 'main', Pose>;
const LAYERS = [{ id: 'main' as const }];

const pose = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }), y: fc.integer({ min: -1000, max: 1000 }),
  width: fc.integer({ min: 0, max: 500 }), height: fc.integer({ min: 0, max: 500 }),
});

function objectOf(entries: readonly (readonly [string, unknown])[]): Data {
  const out: Data = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}
const data = fc.uniqueArray(fc.tuple(dataKey, dataValue), { selector: ([k]) => k, maxLength: 3 }).map(objectOf);
const docKey = fc.constantFrom('app:theme', 'app:grid', '__proto__', 'toString', 'constructor', 'hasOwnProperty');
/** A document value is JSON, so no typed arrays, but it may look like what the writer tags or wraps. */
const docValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue({ maxDepth: 2 }),
  fc.constant(undefined),
  fc.record({ __ta: fc.constantFrom('u8', 'f32'), data: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }) }, { noNullPrototype: true }),
  fc.record({ commands: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }) }, { noNullPrototype: true }),
  fc.jsonValue({ maxDepth: 1 }).map((v) => ({ __raw: v })),
);

interface Model { twin: S; next: number }
interface Real { live: S; reloads: number }

/** Every node, layer, and document value of `scene` in one comparable form: JSON with typed arrays named by type. */
function stateOf(scene: S): unknown {
  const canon = (v: unknown): unknown => {
    if (ArrayBuffer.isView(v)) return { typed: Object.prototype.toString.call(v), values: Array.from(v as Float64Array, (n) => n + 0) };
    if (Array.isArray(v)) return v.map(canon);
    if (v !== null && typeof v === 'object') return Object.keys(v).sort().map((k) => [k, canon((v as Data)[k])]);
    return typeof v === 'number' ? v + 0 : v;
  };
  return canon(scene.toJSON());
}

function historyOf(scene: S): unknown {
  return { index: scene.historyIndex(), labels: scene.historyEntries().map((e) => e.label), undo: scene.canUndo(), redo: scene.canRedo() };
}

function boot(scene: S): S {
  const sceneText = JSON.stringify(scene.toJSON(), serializeReplacer);
  const historyText = JSON.stringify(scene.serializeHistory(), serializeReplacer);
  const json = JSON.parse(sceneText) as SerializedScene<Data, 'main', Pose>;
  const doc = docFromSnapshot(json);
  const next = createScene<Data, 'main', Pose>({ systemLayers: LAYERS, initial: nodeSpecsFromSnapshot(json), ...(doc ? { doc } : {}) });
  const adapter = defaultCommitAdapter(next);
  next.setHistoryAdapter(() => adapter);
  next.restoreHistory(reviveTypedArrays(JSON.parse(historyText)) as Parameters<S['restoreHistory']>[0]);
  return next;
}

const live = (s: S): NodeId[] => [...s.renderOrder()];
const pick = (s: S, n: number): NodeId | undefined => { const ids = live(s); return ids.length ? ids[n % ids.length] : undefined; };

const seen = tally();

/** One edit, run on both scenes alike. */
const edit = (name: string, check: (m: Model) => boolean, run: (s: S, m: Model) => void): fc.Command<Model, Real> => ({
  check,
  run(m, r) {
    run(m.twin, m);
    run(r.live, m);
    seen.count(name);
    expect(stateOf(r.live)).toEqual(stateOf(m.twin));
    expect(historyOf(r.live)).toEqual(historyOf(m.twin));
  },
  toString: () => name,
});

const commands = [
  fc.tuple(fc.boolean(), fc.nat(), pose, data).map(([group, at, p, d]) => {
    let id = '';
    return edit('add', () => true, (s, m) => {
      if (s !== m.twin) { s.add({ id: asNodeId(id), kind: group ? 'group' : 'mark', layer: 'main', pose: p, data: d, ...parentOf(s, at) }); return; }
      id = `n${m.next++}`;
      s.add({ id: asNodeId(id), kind: group ? 'group' : 'mark', layer: 'main', pose: p, data: d, ...parentOf(s, at) });
    });
  }),
  fc.tuple(fc.nat(), pose).map(([at, p]) => edit('setPose', (m) => live(m.twin).length > 0, (s) => s.setPose(pick(s, at)!, p))),
  fc.tuple(fc.nat(), data).map(([at, d]) => edit('update', (m) => live(m.twin).length > 0, (s) => s.update(pick(s, at)!, { data: d }))),
  fc.nat().map((at) => edit('remove', (m) => live(m.twin).length > 0, (s) => s.remove(pick(s, at)!))),
  fc.tuple(fc.nat(), fc.boolean()).map(([at, hidden]) => edit('setHidden', (m) => live(m.twin).length > 0, (s) => s.setHidden(pick(s, at)!, hidden))),
  fc.tuple(docKey, docValue).map(([k, v]) => edit('setDoc', () => true, (s) => s.doc.set(k, v))),
  fc.constant(edit('undo', () => true, (s) => { s.undo(); })),
  fc.constant(edit('redo', () => true, (s) => { s.redo(); })),
  fc.integer({ min: -1, max: 30 }).map((i) => edit('jump', () => true, (s) => { s.jumpToHistoryIndex(i); })),
  fc.constant<fc.Command<Model, Real>>({
    check: () => true,
    run(m, r) {
      r.live = boot(r.live);
      r.reloads++;
      seen.count('reload');
      expect(stateOf(r.live)).toEqual(stateOf(m.twin));
      expect(historyOf(r.live)).toEqual(historyOf(m.twin));
    },
    toString: () => 'reload',
  }),
];

function parentOf(s: S, at: number): { parent?: NodeId } {
  const groups = live(s).filter((id) => s.get(id)?.kind === 'group');
  return groups.length > 0 && at % 3 !== 0 ? { parent: groups[at % groups.length]! } : {};
}

describe('an editor session reloaded at any point', () => {
  it('holds what a session never reloaded holds, through edits, undos, redos, and jumps after each reload', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 60, size: 'large' }), (cmds) => {
      fc.modelRun(() => ({
        model: { twin: createScene<Data, 'main', Pose>({ systemLayers: LAYERS }), next: 0 },
        real: { live: createScene<Data, 'main', Pose>({ systemLayers: LAYERS }), reloads: 0 },
      }), cmds);
    }), runs(RUNS));
    seen.atLeast('reload', RUNS * 2);
    for (const what of ['add', 'update', 'setDoc', 'undo', 'redo', 'jump', 'remove']) seen.atLeast(what, RUNS);
  }, timeoutFor(RUNS, 400));
});
