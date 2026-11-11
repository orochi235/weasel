/**
 * Stateful test of live symmetry over long runs, the second pass: up to 60 creates (at the top of the scene and
 * inside another group), leaves named like `Object.prototype` members, updates of any field to edge values, center
 * moves, activations, bakes, undos, and redos on several groups. After every step the active group is a symmetry
 * group or nothing, every group draws only finite copies, each leaf finds the group holding it, and a bake leaves no
 * symmetry group under what it made; at the end, undoing everything puts back the empty scene and redoing it all
 * puts back the furthest one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asNodeId, createScene, type NodeId, type RectPose, type SceneRegistry } from '@weasel-js/core';
import { createSymmetry } from './controller';
import { editSymmetries, isSymmetryGroup, readGroup, symmetryGroupOf, symmetryRegistry } from './group';
import { symmetryTransforms, type SymmetrySpec } from './kinds';
import { point, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 60;

const edge = fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -0, Number.MIN_VALUE, 1e300, -1e300);
const KEYS = ['kind', 'angle', 'count', 'spacing', 'glide', 'cell', 'cellAngle', 'rowAngle', 'rowSpacing'] as const;
const NUMBERS = ['angle', 'count', 'spacing', 'cellAngle', 'rowAngle', 'rowSpacing'] as const;

const partial: fc.Arbitrary<Partial<SymmetrySpec>> = fc.tuple(
  spec({ maxCount: 8 }), fc.subarray([...KEYS], { minLength: 1 }), fc.option(fc.tuple(fc.constantFrom(...NUMBERS), edge), { nil: null }),
).map(([s, keys, wild]) => ({
  ...Object.fromEntries(keys.map((k) => [k, s[k]])),
  ...(wild ? { [wild[0]]: wild[1] } : {}),
}) as Partial<SymmetrySpec>);

type Op =
  | { op: 'create'; inside: boolean; spec: Partial<SymmetrySpec>; center: { x: number; y: number } }
  | { op: 'leaf'; name: string }
  | { op: 'update'; spec: Partial<SymmetrySpec> }
  | { op: 'move'; center: { x: number; y: number } }
  | { op: 'activate'; pick: number }
  | { op: 'bake' }
  | { op: 'undo' }
  | { op: 'redo' };

const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ inside: fc.boolean(), spec: partial, center: point(300) }).map((r) => ({ op: 'create' as const, ...r })) },
  { weight: 2, arbitrary: fc.constantFrom('__proto__', 'toString', 'constructor', 'hasOwnProperty', 'leaf').map((name) => ({ op: 'leaf' as const, name })) },
  { weight: 4, arbitrary: partial.map((s) => ({ op: 'update' as const, spec: s })) },
  { weight: 2, arbitrary: point(300).map((c) => ({ op: 'move' as const, center: c })) },
  { weight: 2, arbitrary: fc.nat().map((pick) => ({ op: 'activate' as const, pick })) },
  { weight: 1, arbitrary: fc.constant({ op: 'bake' as const }) },
  { weight: 2, arbitrary: fc.constant({ op: 'undo' as const }) },
  { weight: 2, arbitrary: fc.constant({ op: 'redo' as const }) },
);

function under(scene: { childrenOf(id: NodeId): readonly NodeId[]; roots: readonly NodeId[] }, from?: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (n: NodeId): void => { out.push(n); scene.childrenOf(n).forEach(walk); };
  (from === undefined ? scene.roots : [from]).forEach(walk);
  return out;
}

describe('live symmetry over long runs', () => {
  it('keeps every group drawable and every leaf in its group, and undoes and redoes the whole run exactly', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(op, { minLength: 10, maxLength: 60 }), (ops) => {
      const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry as SceneRegistry<RectPose> });
      const sym = createSymmetry(scene as never);
      const empty = JSON.stringify(scene.toJSON());
      let leaves = 0;
      for (const o of ops) {
        const active = sym.active();
        switch (o.op) {
          case 'create':
            sym.create({ center: o.center, symmetry: o.spec, parent: o.inside ? active : null });
            break;
          case 'leaf':
            if (active === null) break;
            scene.add({ kind: 'mark', layer: 'main', parent: active, id: asNodeId(`${o.name}${leaves === 0 ? '' : leaves}`), pose: { x: 10, y: 5, width: 8, height: 8 }, data: {} });
            leaves++;
            break;
          case 'update':
            if (active !== null) sym.update(active, { spec: o.spec });
            break;
          case 'move':
            if (active !== null) sym.update(active, { center: o.center });
            break;
          case 'activate': {
            const groups = under(scene).filter((n) => isSymmetryGroup(scene as never, n));
            sym.setActive(groups.length === 0 ? null : groups[o.pick % groups.length]!);
            break;
          }
          case 'bake': {
            if (active === null) break;
            const out = sym.bake(active)!;
            expect(scene.get(active)).toBeUndefined();
            expect(under(scene, out.group).filter((n) => isSymmetryGroup(scene as never, n))).toEqual([]);
            t.count('baked');
            break;
          }
          case 'undo': scene.undo(); break;
          case 'redo': scene.redo(); break;
        }
        const now = sym.active();
        expect(now === null || isSymmetryGroup(scene as never, now)).toBe(true);
        for (const n of under(scene)) {
          const node = scene.get(n)!;
          if (isSymmetryGroup(scene as never, n)) {
            const g = readGroup(scene as never, n)!;
            for (const m of [...symmetryTransforms(g.spec, g.center), ...editSymmetries(scene as never, n)]) {
              expect(m.every(Number.isFinite)).toBe(true);
            }
            t.count('group');
          } else if (node.kind === 'mark') {
            const holder = node.parent === null ? null : symmetryGroupOf(scene as never, node.parent);
            expect(symmetryGroupOf(scene as never, n)).toBe(holder);
            if (holder !== null && /^(__proto__|toString|constructor)/.test(n)) t.count('prototype-named leaf');
          }
        }
      }
      while (scene.redo()) { /* past any undos the run ended on */ }
      const last = JSON.stringify(scene.toJSON());
      while (scene.undo()) { /* to the start */ }
      expect(JSON.stringify(scene.toJSON())).toBe(empty);
      while (scene.redo()) { /* to the end */ }
      expect(JSON.stringify(scene.toJSON())).toBe(last);
    }), runs(RUNS));
    t.atLeast('baked', 10);
    t.atLeast('group', 200);
    t.atLeast('prototype-named leaf', 20);
  }, timeoutFor(RUNS, 300));
});
