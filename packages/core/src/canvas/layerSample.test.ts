import { describe, it, expect } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { createScene } from 'core/scene/scene';
import { planLayerSample } from './layerSample';
import { documentLayersOf } from './SceneCanvas/useSceneColorAt';

const rect = (x: number, y: number, w: number, h: number): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width: w, height: h },
  fill: { paint: { kind: 'solid', color: '#ff0000' } },
});

const screenLayer = (cmds: DrawCommand[]): RenderLayer<unknown> => ({
  id: 'doc', label: 'Doc', space: 'screen', draw: () => cmds,
});

const at = (x: number, y: number) => ({
  view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
  dims: { width: 100, height: 100, dpr: 2 },
  point: { x, y },
});

describe('planLayerSample', () => {
  it('places the device pixel under the point in the middle of a 3 × 3 raster', () => {
    const plan = planLayerSample({ layers: [screenLayer([rect(0, 0, 100, 100)])], ...at(10.3, 20.8) })!;
    expect([plan.width, plan.height]).toEqual([3, 3]);
    expect(plan.center).toEqual({ x: 1, y: 1 });
    // CSS (10.3, 20.8) at dpr 2 is device (20, 41); the raster starts one pixel up and left.
    expect(Array.from(plan.screen)).toEqual([2, 0, 0, 0, 2, 0, -19, -40, 1]);
  });

  it('draws only what reaches the region', () => {
    const near = rect(9, 19, 4, 4);
    const far = rect(80, 80, 4, 4);
    const plan = planLayerSample({ layers: [screenLayer([near, far])], ...at(10, 20) })!;
    const group = plan.commands[0] as Extract<DrawCommand, { kind: 'group' }>;
    expect(group.children).toEqual([near]);
  });

  it('is null off the canvas, or at a point that is not a number', () => {
    const layers = [screenLayer([])];
    expect(planLayerSample({ layers, ...at(-1, 5) })).toBeNull();
    expect(planLayerSample({ layers, ...at(100, 5) })).toBeNull();
    expect(planLayerSample({ layers, ...at(Number.NaN, 5) })).toBeNull();
  });
});

describe('documentLayersOf', () => {
  it('keeps the scene layers the canvas shows, leaving out hidden and annotation layers', () => {
    const scene = createScene({ systemLayers: [{ id: 'art' }, { id: 'notes', annotation: true }, { id: 'off' }] });
    const layer = (key: string): { key: string; layer: RenderLayer<unknown> } =>
      ({ key, layer: { id: key, label: key, draw: () => [] } });
    const slot = { layers: [layer('scene:art'), layer('scene:notes'), layer('scene:off')] };
    expect(documentLayersOf(slot, scene, { 'scene:off': false }).map((l) => l.id)).toEqual(['scene:art']);
    expect(documentLayersOf(null, scene, undefined)).toEqual([]);
  });
});
