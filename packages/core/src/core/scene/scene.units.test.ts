import { describe, it, expect } from 'vitest';
import { resolveScoped, type UnitScope } from '@weasel-js/quantity';
import { createScene, sceneFromJSON } from './scene';
import { reconcileSpecs } from './reconcileSpecs';
import { sceneMutators } from './sceneMutators';
import { sceneSharedUnitScopes, sceneUnitScopes } from './unitScopes';
import { asNodeId, type AddNodeSpec, type GroupNode, type RectPose } from './types';

type Spec = AddNodeSpec<object, 'main', RectPose>;
const POSE = { x: 0, y: 0, width: 10, height: 10 };
const G = asNodeId('g');
const INNER = asNodeId('inner');
const LEAF = asNodeId('leaf');

const INCHES: UnitScope = { system: { base: 'in', units: { in: 1, ft: 12 } } };
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };
const CM: UnitScope = { system: { base: 'cm', units: { cm: 1 } }, scale: 10 };

const spec = (id: string, extra: Partial<Spec> = {}): Spec =>
  ({ id: asNodeId(id), kind: 'mark', layer: 'main', pose: { ...POSE }, data: {}, ...extra });
const sceneOf = (specs: Spec[] = []) =>
  createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs });
const unitsOf = (scene: ReturnType<typeof sceneOf>, id = G) =>
  (scene.get(id) as GroupNode<object, 'main', RectPose>).units;

describe('Scene — a container declares its unit scope', () => {
  it('keeps the scope a node is added with, group or mark', () => {
    const scene = sceneOf();
    scene.add(spec('g', { kind: 'group', units: MM }));
    scene.add(spec('leaf', { units: MM }));
    expect(unitsOf(scene)).toEqual(MM);
    expect(scene.get(LEAF)!.units).toEqual(MM);
  });

  it('keeps it through construction, a snapshot, and a removal undone', () => {
    const scene = sceneOf([spec('g', { kind: 'group', units: MM })]);
    expect(unitsOf(scene)).toEqual(MM);
    expect(unitsOf(sceneFromJSON(JSON.parse(JSON.stringify(scene.toJSON()))))).toEqual(MM);
    scene.remove(G);
    scene.undo();
    expect(unitsOf(scene)).toEqual(MM);
  });

  it('leaves a container that declares none out of the snapshot', () => {
    const scene = sceneOf([spec('g', { kind: 'group' })]);
    expect(JSON.stringify(scene.toJSON())).not.toContain('units');
  });

  it('setUnits is one undo step, and null clears the scope', () => {
    const scene = sceneOf([spec('g', { kind: 'group' })]);
    scene.setUnits(G, MM);
    expect(unitsOf(scene)).toEqual(MM);
    scene.undo();
    expect(unitsOf(scene)).toBeUndefined();
    scene.redo();
    scene.setUnits(G, null);
    expect(unitsOf(scene)).toBeUndefined();
    expect(scene.historyEntries()).toHaveLength(2);
  });

  it('setUnits sets a scope on a mark', () => {
    const scene = sceneOf([spec('leaf')]);
    scene.setUnits(LEAF, MM);
    expect(scene.get(LEAF)!.units).toBe(MM);
  });

  it('re-adding a node through an adapter keeps its scope', () => {
    const scene = sceneOf([spec('g', { kind: 'group', units: MM })]);
    const node = scene.get(G)!;
    const adapter = sceneMutators(scene);
    adapter.removeNode('g');
    adapter.insertNode(node);
    expect(unitsOf(scene)).toEqual(MM);
  });

  it('reconcileSpecs writes a changed scope without replacing the container', () => {
    const prev = [spec('g', { kind: 'group', units: MM }), spec('leaf', { parent: G })];
    const scene = sceneOf(prev);
    const before = scene.get(G);
    reconcileSpecs(scene, prev, [spec('g', { kind: 'group', units: CM }), spec('leaf', { parent: G })]);
    expect(scene.get(G)).toBe(before);
    expect(unitsOf(scene)).toEqual(CM);
  });
});

describe('sceneUnitScopes', () => {
  const nested = () => sceneOf([
    spec('g', { kind: 'group', units: MM }),
    spec('inner', { kind: 'group', parent: G, units: CM }),
    spec('leaf', { parent: INNER }),
  ]);

  it('lists the scopes enclosing a node, outermost first', () => {
    expect(sceneUnitScopes(nested(), LEAF, INCHES)).toEqual([INCHES, MM, CM]);
  });

  it("leaves out a container's own scope unless asked for it", () => {
    const scene = nested();
    expect(sceneUnitScopes(scene, INNER, INCHES)).toEqual([INCHES, MM]);
    expect(sceneUnitScopes(scene, INNER, INCHES, { inclusive: true })).toEqual([INCHES, MM, CM]);
  });

  it('resolves a value written beside a node in the root scope', () => {
    // 5 cm is 50 mm, which is 50 / 25.4 in.
    const scopes = sceneUnitScopes(nested(), LEAF, INCHES);
    expect(resolveScoped({ value: 5, unit: 'cm' }, scopes)).toBeCloseTo(50 / 25.4);
  });
});

describe('sceneSharedUnitScopes', () => {
  const MM_TOO: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };
  const TWIN = asNodeId('twin');
  const scene = () => sceneOf([
    spec('g', { kind: 'group', units: MM }),
    spec('inner', { kind: 'group', parent: G, units: CM }),
    spec('leaf', { parent: INNER }),
    spec('beside', { parent: G }),
    spec('twin', { kind: 'group', units: MM_TOO }),
    spec('inTwin', { parent: TWIN }),
    spec('loose'),
  ]);

  it("is one node's own chain", () => {
    expect(sceneSharedUnitScopes(scene(), [LEAF], INCHES)).toEqual([INCHES, MM, CM]);
  });

  it('keeps the scopes every node sits in', () => {
    expect(sceneSharedUnitScopes(scene(), [LEAF, asNodeId('beside')], INCHES)).toEqual([INCHES, MM]);
    expect(sceneSharedUnitScopes(scene(), [LEAF, asNodeId('loose')], INCHES)).toEqual([INCHES]);
  });

  it('counts two containers declaring the same scope as one', () => {
    expect(sceneSharedUnitScopes(scene(), [asNodeId('beside'), asNodeId('inTwin')], INCHES)).toEqual([INCHES, MM]);
  });

  it('is the root alone for no nodes', () => {
    expect(sceneSharedUnitScopes(scene(), [], INCHES)).toEqual([INCHES]);
  });
});
