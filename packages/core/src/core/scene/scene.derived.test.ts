import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId, type RectPose } from './types';
import { PATH_L, PATH_M, type PolygonPath } from '../geometry/path';

const LAYERS = [{ id: 'main' as const }];

/** A derive that draws a line between the centers of its two dependencies. */
const connectCenters = (_node: unknown, deps: readonly (RectPose | undefined)[]): PolygonPath | null => {
  const [from, to] = deps;
  if (!from || !to) return null;
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([
      from.x + from.width / 2, from.y + from.height / 2,
      to.x + to.width / 2, to.y + to.height / 2,
    ]),
    fillRule: 'nonzero',
  };
};

const registry = { derive: { 'test:connect': connectCenters } };

describe('derived geometry — serialization', () => {
  it('round-trips dependsOn and the derive registry key', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });

    const json = scene.toJSON();
    const node = json.nodes.find((n) => n.id === edge)!;
    expect(node.dependsOn).toEqual([a, b]);
    expect(node.deriveKey).toBe('test:connect');

    // sceneFromJSON reads systemLayers out of the JSON — it takes no such option.
    const restored = sceneFromJSON(json, { registry });
    const live = restored.get(asNodeId(edge))!;
    expect(live.dependsOn).toEqual([a, b]);
    expect(live.derive).toBe(connectCenters);
  });

  it('a node with no dependsOn serializes without the fields', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const json = scene.toJSON();
    expect(json.nodes[0]!.dependsOn).toBeUndefined();
    expect(json.nodes[0]!.deriveKey).toBeUndefined();
  });

  it('keeps derive attached across undo then redo', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    scene.undo();
    scene.redo();
    // kit:add replays without the spec — without a redo cache this is undefined.
    expect(scene.get(asNodeId(edge))!.derive).toBe(connectCenters);
  });

  it('warns rather than throwing when a derive key is missing at replay', () => {
    // The redo cache makes site 4's registry lookup unreachable in-process, so
    // this goes through a serialized history restored into a registry-less scene.
    const a = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const dep = a.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    a.add({
      id: asNodeId('edge'), kind: 'leaf', layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [dep], derive: connectCenters,
    });
    a.undo();   // head state: the edge is absent; its add entry carries the deriveKey
    const snap = a.serializeHistory();

    const b = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry: {} });
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(() => b.redo()).not.toThrow();
    const node = b.get(asNodeId('edge'))!;
    expect(node.dependsOn).toEqual([dep]);
    expect(node.derive).toBeUndefined();
  });

  it('throws from toJSON when derive is not in the registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a], derive: () => null,   // never registered
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });
});
