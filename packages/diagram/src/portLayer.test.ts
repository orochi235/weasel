import { describe, it, expect } from 'vitest';
import { createScene, type Scene } from '@weasel-js/core';
import { portLayer, sceneParticipants } from './portLayer';
import { PORT_AFFORDANCE_KIND, PORT_LAYER_ID, portScratchOf } from './portAffordance';

interface Data { diagram?: unknown }
interface Rect { x: number; y: number; width: number; height: number }

function sceneWith(): Scene<Data, 'main', Rect> {
  const scene = createScene<Data, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: 'a' as never, kind: 'leaf', layer: 'main',
    pose: { x: 0, y: 0, width: 100, height: 40 }, data: { diagram: {} },
  });
  return scene;
}

describe('sceneParticipants', () => {
  it('reports a participant at the pose it is painted at, not the one stored', () => {
    const scene = sceneWith();
    const node = scene.get('a' as never)!;
    scene.overrides.set('a' as never, { pose: { x: 500, y: 0, width: 100, height: 40 } });
    const [first] = [...sceneParticipants(scene)()];
    expect(first!.node.id).toBe(node.id);
    expect(first!.pose.x).toBe(500);
  });
});

describe('portLayer', () => {
  it('hit-tests a port and reports it under the layer id the binding names', () => {
    const layer = portLayer(sceneParticipants(sceneWith()));
    expect(layer.id).toBe(PORT_LAYER_ID);
    expect(PORT_AFFORDANCE_KIND).toBe(`layer:${PORT_LAYER_ID}`);
    // The layer unwraps a `CanvasHelpers` envelope or takes a bare state; it
    // returns null for no state at all, so a test must hand it one.
    const state = {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    };
    const hit = layer.hitTest!(
      100, 20, state, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 200 },
    );
    expect(hit).toMatchObject({ strength: 'exclusive' });
    expect(portScratchOf({ payload: hit!.initialScratch })).toMatchObject({
      nodeId: 'a', portId: 'e',
    });
  });

  it('reports nothing where there is no port', () => {
    const layer = portLayer(sceneParticipants(sceneWith()));
    const state = {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    };
    expect(layer.hitTest!(
      50, 20, state, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 200, height: 200 },
    )).toBeNull();
  });
});
