import { describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId } from './types';
import type { NodeId, SerializedScene, SystemLayerSpec } from './types';
import { POSE, makeScene, type Data } from './testing/makeScene';

describe('scene.toJSON', () => {
  it('captures a flat scene with no parents', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const a = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = scene.toJSON();
    expect(json.version).toBe(2);
    expect(json.systemLayers.map((l) => l.id)).toEqual(['structures', 'plantings']);
    expect(json.nodes).toHaveLength(2);
    expect(json.nodes[0]).toMatchObject({ id: a, kind: 'mark', layer: 'structures', pose: POSE });
    expect(json.nodes[1]).toMatchObject({ id: b, kind: 'mark', layer: 'structures', pose: POSE });
    expect(json.nodes[0].parent).toBeUndefined();
  });

  it('captures parent ids for nested subtrees', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const bed = scene.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = scene.toJSON();
    const plantNode = json.nodes.find((n) => n.id === plant)!;
    expect(plantNode.parent).toBe(bed);
  });

  it('captures layer visible=false and locked=true; omits defaults', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    scene.setLayerVisible('structures', false);
    scene.setLayerLocked('plantings', true);
    const json = scene.toJSON();
    const s = json.systemLayers.find((l) => l.id === 'structures')!;
    const p = json.systemLayers.find((l) => l.id === 'plantings')!;
    expect(s.visible).toBe(false);
    expect(s.locked).toBeUndefined();
    expect(p.visible).toBeUndefined();
    expect(p.locked).toBe(true);
  });

  it('writes nodes in tree preorder, across layers', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const a = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'b' } });
    const c = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'c' } });
    const json = scene.toJSON();
    expect(json.nodes.map((n) => n.id)).toEqual([a, b, c]);
  });

  it('keeps sibling order through toJSON and loadState when siblings sit on different layers', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const bed = scene.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const p1 = scene.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'p1' }, parent: bed });
    const s1 = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 's1' }, parent: bed });
    const top = scene.add({ kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'top' } });
    const last = scene.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'last' } });
    const order = scene.renderOrder();

    scene.loadState(scene.toJSON());

    expect(scene.roots).toEqual([bed, top, last]);
    const bedNode = scene.get(bed)!;
    expect(bedNode.kind === 'group' && bedNode.children).toEqual([p1, s1]);
    expect(scene.renderOrder()).toEqual(order);
  });

  it('writes clipFromPoseKey when the factory is in the registry', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const scene = createScene<Data, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = scene.add({
      kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBe('ellipse');
  });

  it('throws when a container has clipFromPose but no matching registry key', () => {
    const scene = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: {},
    });
    scene.add({
      kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });

  it('omits clipFromPoseKey for containers without clipFromPose', () => {
    const scene = createScene<Data, 'structures' | 'plantings'>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
    });
    const bed = scene.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBeUndefined();
  });
});

describe('sceneFromJSON', () => {
  it('reconstructs a flat scene from JSON', () => {
    const original = makeScene();
    const a = original.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    original.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect([...restored.roots]).toContain(asNodeId(a));
    expect(restored.get(asNodeId(a))?.data.label).toBe('a');
  });

  it('reconstructs parent/child relationships', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = original.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect(restored.get(asNodeId(plant))?.parent).toBe(asNodeId(bed));
    expect([...restored.childrenOf(asNodeId(bed))]).toEqual([asNodeId(plant)]);
  });

  it('restores layer visibility and locked state', () => {
    const original = makeScene();
    original.setLayerVisible('structures', false);
    original.setLayerLocked('plantings', true);
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    const structures = restored.layers.find((l) => l.id === 'structures')!;
    const plantings = restored.layers.find((l) => l.id === 'plantings')!;
    expect(structures.visible).toBe(false);
    expect(plantings.locked).toBe(true);
  });

  it('resolves clipFromPoseKey via the registry', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const original = createScene<Data, 'structures' | 'plantings', typeof POSE>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = original.add({
      kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const restoredBed = restored.get(asNodeId(bed));
    expect(restoredBed?.kind).toBe('group');
    expect((restoredBed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
  });

  it('a loaded container keeps its clipFromPose through remove and undo', () => {
    const factory = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const json: SerializedScene<Data, 'structures', typeof POSE> = {
      version: 2,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'group',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'ellipse',
      }],
    };
    const scene = sceneFromJSON(json, { registry: { clipFromPose: { 'ellipse': factory } } });
    scene.remove(asNodeId('bed'));
    expect(scene.get(asNodeId('bed'))).toBeUndefined();
    scene.undo();
    const bed = scene.get(asNodeId('bed'));
    expect((bed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
  });

  it('throws on unknown version', () => {
    const json = { version: 3, systemLayers: [{ id: 'structures' as const }], nodes: [] };
    expect(() => sceneFromJSON(json as never, {})).toThrow(/unsupported version/);
  });

  it('throws on unknown clipFromPoseKey', () => {
    const json: SerializedScene<Data, 'structures', typeof POSE> = {
      version: 2,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'group',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'nonexistent',
      }],
    };
    expect(() => sceneFromJSON(json, { registry: {} })).toThrow(/unknown clipFromPose key 'nonexistent'/);
  });

  it('accepts a higher-layer child subtree in JSON (renders above its parent)', () => {
    const json: SerializedScene<Data, 'structures' | 'plantings', typeof POSE> = {
      version: 2,
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      nodes: [
        { id: 'bed', kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } },
        { id: 'plant', kind: 'mark', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: 'bed' },
      ],
    };
    const scene = sceneFromJSON(json, {});
    expect(scene.get('plant' as never)?.layer).toBe('plantings');
  });

  it('full round-trip: toJSON → sceneFromJSON → toJSON produces equivalent output', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    original.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p1' }, parent: bed });
    original.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'p2' }, parent: bed });
    original.setLayerVisible('plantings', false);
    const json1 = original.toJSON();
    const restored = sceneFromJSON(json1, {});
    const json2 = restored.toJSON();
    expect(json2).toEqual(json1);
  });
});

describe('Scene.loadState', () => {
  type D = { kind: string; color: string };
  const LAYERS: SystemLayerSpec<'main'>[] = [{ id: 'main' }];

  function sceneWithTwoNodes() {
    const s = createScene<D, 'main'>({ systemLayers: LAYERS });
    s.add({ kind: 'mark', layer: 'main', pose: { x: 1, y: 2, width: 3, height: 4 }, data: { kind: 'a', color: 'red' } });
    s.add({ kind: 'mark', layer: 'main', pose: { x: 5, y: 6, width: 7, height: 8 }, data: { kind: 'b', color: 'blue' } });
    return s;
  }

  it('round-trips toJSON → loadState into an empty scene', () => {
    const src = sceneWithTwoNodes();
    const json = src.toJSON();
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    dst.loadState(json);
    expect(dst.toJSON()).toEqual(json);
    expect(dst.nodes.size).toBe(2);
  });

  it('preserves the instance, bumps version, and notifies once', () => {
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    const ref = dst;
    const listener = vi.fn();
    dst.subscribe(listener);
    const v0 = dst.getVersion();
    dst.loadState(sceneWithTwoNodes().toJSON());
    expect(dst).toBe(ref);
    expect(dst.getVersion()).toBeGreaterThan(v0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('replaces existing content (wipes prior nodes)', () => {
    const dst = sceneWithTwoNodes();
    const emptyJson = createScene<D, 'main'>({ systemLayers: LAYERS }).toJSON();
    dst.loadState(emptyJson);
    expect(dst.nodes.size).toBe(0);
    expect(dst.roots.length).toBe(0);
  });

  it('clears history (no undo/redo after load)', () => {
    const dst = sceneWithTwoNodes();
    expect(dst.canUndo()).toBe(true);
    dst.loadState(sceneWithTwoNodes().toJSON());
    expect(dst.canUndo()).toBe(false);
    expect(dst.canRedo()).toBe(false);
  });

  it('restores layer visibility/lock flags', () => {
    const src = createScene<D, 'main'>({ systemLayers: [{ id: 'main' }] });
    src.setLayerVisible('main', false);
    src.setLayerLocked('main', true);
    const dst = createScene<D, 'main'>({ systemLayers: [{ id: 'main' }] });
    dst.loadState(src.toJSON());
    expect(dst.layers[0].visible).toBe(false);
    expect(dst.layers[0].locked).toBe(true);
  });

  it('throws on an unsupported version', () => {
    const dst = createScene<D, 'main'>({ systemLayers: LAYERS });
    expect(() => dst.loadState({ version: 3, systemLayers: LAYERS, nodes: [] } as never)).toThrow(/version/);
  });

  it('restores a parented snapshot in place over a populated scene', () => {
    const src = createScene<D, 'main'>({ systemLayers: LAYERS });
    const bedId = src.add({ kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'bed', color: 'brown' } });
    src.add({ kind: 'mark', layer: 'main', parent: bedId, pose: { x: 1, y: 1, width: 2, height: 2 }, data: { kind: 'plant', color: 'green' } });
    const json = src.toJSON();

    const dst = sceneWithTwoNodes(); // pre-populated with different, flat content
    dst.loadState(json);

    expect(dst.toJSON()).toEqual(json);
    expect([...dst.roots]).toEqual([bedId]);
    const bed = dst.get(bedId);
    expect(bed?.kind).toBe('group');
    const children = (bed as { children: readonly string[] }).children;
    expect(children.length).toBe(1);
    expect(dst.get(children[0] as NodeId)?.parent).toBe(bedId);
    expect([...dst.renderOrder()]).toEqual([bedId, children[0]]);
  });
});

describe('user layers survive a round-trip', () => {
  const baseOpts = () => ({ systemLayers: [{ id: 'base' as const }] });
  const withUserLayer = () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.setLayerVisible('fx', false);
    scene.setLayerLocked('fx', true);
    return scene;
  };

  it('loadState restores a user layer as a user layer, with its name', () => {
    const scene = withUserLayer();
    const json = scene.toJSON();
    scene.loadState(json);
    const fx = scene.layers.find((l) => l.id === 'fx')!;
    expect(fx.kind).toBe('user');
    expect(fx.kind === 'user' && fx.name).toBe('Effects');
    expect(fx.visible).toBe(false);
    expect(fx.locked).toBe(true);
  });

  it('sceneFromJSON restores a user layer as a user layer, with its name', () => {
    const json = withUserLayer().toJSON();
    const loaded = sceneFromJSON<{ v: number }, 'base' | 'fx', { x: number }>(json, {});
    const fx = loaded.layers.find((l) => l.id === 'fx')!;
    expect(fx.kind).toBe('user');
    expect(fx.kind === 'user' && fx.name).toBe('Effects');
  });

  it('a restored user layer can still be renamed', () => {
    const scene = withUserLayer();
    scene.loadState(scene.toJSON());
    expect(() => scene.renameLayer('fx', 'Glow')).not.toThrow();
  });

  it('a snapshot written before layer kind was serialized loads as system layers', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.loadState({
      version: 2,
      systemLayers: [{ id: 'base' }, { id: 'fx', visible: false }],
      nodes: [],
    });
    expect(scene.layers.map((l) => l.kind)).toEqual(['system', 'system']);
    expect(scene.layers[1].visible).toBe(false);
  });
});
