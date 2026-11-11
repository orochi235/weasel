/**
 * Stateful property test of the data join: random runs of joins (with and without an exit callback), undos, redos,
 * removals from outside, and nodes squatting on a key elsewhere, against a model of the layer. After every step the
 * layer holds exactly the model's marks with their poses and payloads, a join's selection is its data in order, the
 * exit set is what left, a join that changes nothing records no undo step, and an undo puts the layer back exactly,
 * order included.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId, type NodeId } from '@weasel-js/core';
import { d3Bind } from './bind';
import { key, makeScene, pose, runs, tally, timeoutFor, type Pose, type TestScene } from './pbt.fixture';

const RUNS = 150;

interface Datum { id: string; pose: Pose; tag: number }

type Op =
  | { op: 'join'; data: Datum[]; exit: boolean; payload: boolean }
  | { op: 'undo' }
  | { op: 'redo' }
  | { op: 'remove'; id: string }
  | { op: 'squat'; id: string; layer: 'other' | 'graph-group' };

const datum = fc.record({ id: key, pose, tag: fc.integer({ min: 0, max: 3 }) });
const dataset = fc.uniqueArray(datum, { selector: (d) => d.id, maxLength: 6 });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 8, arbitrary: fc.record({ data: dataset, exit: fc.boolean(), payload: fc.boolean() }).map((o) => ({ op: 'join' as const, ...o })) },
  { weight: 3, arbitrary: fc.constant({ op: 'undo' as const }) },
  { weight: 2, arbitrary: fc.constant({ op: 'redo' as const }) },
  { weight: 1, arbitrary: key.map((id) => ({ op: 'remove' as const, id })) },
  { weight: 1, arbitrary: fc.record({ id: key, layer: fc.constantFrom('other' as const, 'graph-group' as const) }).map((o) => ({ op: 'squat' as const, ...o })) },
);

/** The layer as `[id, pose, data]`, in order. */
const layerOf = (scene: TestScene) => scene.nodesOnLayer('graph').map((n) => [n.id, n.kind, n.pose, n.data] as const);

describe('d3Bind join', () => {
  it('keeps the layer to the data through joins, undos, redos, and outside edits', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(opArb, { minLength: 4, maxLength: 20 }), (ops) => {
      const scene = makeScene();
      // The layer after each history entry, by `historyIndex`.
      const states = new Map<number, ReturnType<typeof layerOf>>([[scene.historyIndex(), layerOf(scene)]]);
      for (const o of ops) {
        seen.count(o.op);
        if (o.op === 'join') {
          const before = layerOf(scene);
          const steps = scene.historyIndex();
          const squatted = o.data.filter((d) => {
            const n = scene.get(asNodeId(d.id));
            return n !== undefined && !(n.kind === 'mark' && n.layer === 'graph');
          });
          const exited: NodeId[] = [];
          const b = d3Bind(scene, o.data, { key: (d) => d.id }).pose((d) => d.pose);
          if (o.payload) b.data((d) => ({ tag: d.tag }));
          if (o.exit) b.exit((sel) => { exited.push(...sel.ids); });
          if (squatted.length > 0) {
            seen.count('squatted');
            expect(() => b.join()).toThrow(/d3Bind/);
            expect(layerOf(scene)).toEqual(before);
            expect(scene.historyIndex()).toBe(steps);
            continue;
          }
          const sel = b.join();
          expect(sel.ids).toEqual(o.data.map((d) => d.id));
          expect(sel.data).toEqual(o.data);
          const keep = new Set(o.data.map((d) => d.id));
          const left = before.filter(([id, kind]) => kind === 'mark' && !keep.has(id)).map(([id]) => id);
          if (o.exit) {
            expect(exited).toEqual(left);
            if (left.length > 0) seen.count('exit callback');
          }
          const after = layerOf(scene);
          const byId = new Map(after.map(([id, , p, data]) => [id, { p, data }]));
          for (const d of o.data) {
            const got = byId.get(asNodeId(d.id));
            expect(got?.p).toEqual(d.pose);
            const prior = before.find(([id]) => id === d.id);
            const wantData = o.payload ? { tag: d.tag } : prior ? prior[3] : {};
            expect(got?.data).toEqual(wantData);
          }
          const marks = after.filter(([, kind]) => kind === 'mark').map(([id]) => id);
          const want = o.exit ? [...new Set([...keep, ...left])] : [...keep];
          expect(new Set(marks)).toEqual(new Set(want));
          // Survivors keep their places; nothing that stayed moves.
          const stayed = before.map(([id]) => id).filter((id) => byId.has(id));
          expect(after.map(([id]) => id).filter((id) => stayed.includes(id))).toEqual(stayed);
          if (JSON.stringify(after) === JSON.stringify(before)) {
            seen.count('no-op join');
            expect(scene.historyIndex()).toBe(steps);
          } else {
            seen.count('join');
          }
        } else if (o.op === 'undo' || o.op === 'redo') {
          const did = o.op === 'undo' ? scene.undo() : scene.redo();
          if (did) seen.count(`${o.op} did`);
        } else if (o.op === 'remove') {
          if (!scene.get(asNodeId(o.id))) continue;
          scene.remove(asNodeId(o.id));
        } else {
          if (scene.get(asNodeId(o.id))) continue;
          scene.add(o.layer === 'other'
            ? { id: asNodeId(o.id), kind: 'mark', layer: 'other', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} }
            : { id: asNodeId(o.id), kind: 'group', layer: 'graph', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
        }
        const now = layerOf(scene);
        const known = states.get(scene.historyIndex());
        // Undo and redo land on exactly the layer that history entry left.
        if (known && (o.op === 'undo' || o.op === 'redo')) expect(now).toEqual(known);
        states.set(scene.historyIndex(), now);
        if (o.op !== 'undo' && o.op !== 'redo') for (const i of [...states.keys()]) if (i > scene.historyIndex()) states.delete(i);
      }
    }), runs(RUNS));
    seen.atLeast('join', RUNS);
    seen.atLeast('no-op join', RUNS / 10);
    seen.atLeast('undo did', RUNS / 2);
    seen.atLeast('redo did', RUNS / 15);
    seen.atLeast('exit callback', RUNS / 5);
    seen.atLeast('squatted', RUNS / 10);
  }, timeoutFor(RUNS, 40));
});

