import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { Node } from 'core/scene/types';
import type { HierarchicalAdapter } from '../buildSceneTree';
import { sceneToAdapter } from '../sceneAdapter';
import { useSceneSlotLayers } from './useSceneSlotLayers';

type Pose = { x: number; y: number; width: number; height: number };
type TestNode = Node<Record<string, never>, 'bg', Pose>;

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100, dpr: 1 };
const BOX = { x: 1, y: 2, width: 10, height: 10 };

function setup(over: {
  slot?: unknown;
  previewIds?: () => Iterable<string> | null;
} = {}) {
  const scene = createScene<Record<string, never>, 'bg', Pose>({ systemLayers: [{ id: 'bg' }] });
  const a = scene.add({ kind: 'mark', layer: 'bg', pose: BOX, data: {} });
  const b = scene.add({ kind: 'mark', layer: 'bg', pose: BOX, data: {} });
  const drawn: string[] = [];
  const slot = 'slot' in over
    ? over.slot
    : { drawOne: (node: TestNode) => { drawn.push(node.id); return []; } };
  const { result } = renderHook(() => useSceneSlotLayers<Record<string, never>, 'bg', Pose>({
    slot: slot as never,
    scene,
    adapter: sceneToAdapter(scene) as unknown as HierarchicalAdapter<TestNode, Pose>,
    alphaFor: undefined,
    colorOverrides: undefined,
    boundsOf: () => BOX,
    previewIds: over.previewIds ?? (() => null),
  }));
  const paint = (data: unknown = null): void => {
    drawn.length = 0;
    for (const { layer } of result.current.layers?.layers ?? []) layer.draw(data, VIEW, DIMS);
  };
  return { a, b, drawn, paint, result };
}

describe('useSceneSlotLayers', () => {
  it('builds one canvas layer per scene layer, keyed as an anchor', () => {
    const { result } = setup();
    expect(result.current.layers?.layers.map((l) => l.key)).toEqual(['scene:bg']);
  });

  it('leaves out the committed paint of an id the in-flight gesture previews', () => {
    const all = setup();
    all.paint();
    expect(all.drawn).toEqual([all.a, all.b]);

    let previewed: string[] = [];
    const ghosting = setup({ previewIds: () => previewed });
    previewed = [ghosting.a];
    ghosting.paint();
    expect(ghosting.drawn).toEqual([ghosting.b]);
  });

  it('paints a pre-built layer as the whole slot, under the bare anchor', () => {
    const layer = { id: 'mine', label: 'Mine', draw: () => [] };
    const { result } = setup({ slot: { layer } as never });
    expect(result.current.layers?.layers).toEqual([{ key: 'scene', layer }]);
  });

  it('builds nothing for a slot switched off', () => {
    expect(setup({ slot: null }).result.current.layers).toBeUndefined();
  });

  it('records each node into the debug sink on the draw envelope, and nowhere without one', () => {
    const { a, b, paint } = setup();
    const sink = { recordBounds: vi.fn(), recordOrigin: vi.fn() };
    paint({ getDebug: () => sink });
    expect(sink.recordBounds.mock.calls).toEqual([[a, BOX], [b, BOX]]);
    expect(sink.recordOrigin.mock.calls).toEqual([[a, { x: 1, y: 2 }], [b, { x: 1, y: 2 }]]);

    sink.recordBounds.mockClear();
    paint({ getDebug: () => null });
    paint(null);
    expect(sink.recordBounds).not.toHaveBeenCalled();
  });
});
