/**
 * The selection chrome `<SceneCanvas>` paints for a node on a parallax layer
 * sits where the plane draws the node, not where its pose sits in the camera's
 * world. Read through the helpers every layer's `draw` receives — the same
 * `getEffectiveBounds` the selection overlay reads.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

type Pose = { x: number; y: number; width: number; height: number };
type Helpers = { getEffectiveBounds(id: string): { x: number; y: number; width: number; height: number } | null };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
afterEach(cleanup);

function chromeBounds(id: string, parallax: { pan: number }) {
  const scene = createScene<unknown, 'trees' | 'main', Pose>({
    systemLayers: [{ id: 'trees', parallax }, { id: 'main' }],
  });
  const tree = scene.add({
    id: asNodeId('tree'), kind: 'container', layer: 'trees',
    pose: { x: 400, y: 300, width: 30, height: 50 }, data: { fill: null },
  });
  scene.add({
    id: asNodeId('trunk'), kind: 'leaf', layer: 'trees', parent: tree,
    pose: { x: 410, y: 330, width: 10, height: 20 }, data: {},
  });
  scene.add({
    id: asNodeId('bush'), kind: 'leaf', layer: 'trees',
    pose: { x: 100, y: 300, width: 40, height: 20 }, data: {},
  });
  let helpers: Helpers | null = null;
  const probe: RenderLayer<unknown> = {
    id: 'probe', label: 'probe', space: 'screen',
    draw: (data) => { helpers = data as Helpers; return []; },
  };
  render(
    <SceneCanvas<unknown, 'trees' | 'main', Pose>
      scene={scene} width={600} height={400}
      view={{ x: 100, y: 0, scale: { x: 1, y: 1 } }}
      selectionOptions={{ initial: [asNodeId(id)] }}
      layers={{ probe: { layer: probe } }}
      syncPaint
    />,
  );
  expect(helpers).not.toBeNull();
  return helpers!.getEffectiveBounds(id);
}

describe('SceneCanvas — selection chrome on a parallax layer', () => {
  // The camera has panned 100; a plane at pan 1.3 has moved 130, so its
  // content sits 30 left of where its poses would put it.
  it('puts a leaf\'s box where the plane draws it', () => {
    expect(chromeBounds('bush', { pan: 1.3 })).toMatchObject({ x: 70, y: 300, width: 40, height: 20 });
  });

  it('puts a container\'s box where the plane draws it', () => {
    expect(chromeBounds('tree', { pan: 1.3 })).toMatchObject({ x: 370, y: 300, width: 30, height: 50 });
  });
});
