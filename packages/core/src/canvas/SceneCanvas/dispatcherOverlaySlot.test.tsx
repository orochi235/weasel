/**
 * `<SceneCanvas layers>` slots the canvas builds itself: a pre-built entry paints in its place, and a config
 * reaches the layer it builds. The GL recorder is load-bearing: without a WebGL2 context every paint bails before drawing.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { SceneCanvas } from '../SceneCanvas';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import type { RenderLayer } from 'core/layers/render';
import { WeaselProvider } from '../../WeaselProvider';
import * as overlay from './useDispatcherOverlayLayer';

vi.mock('./useDispatcherOverlayLayer', async (importOriginal) => {
  const real = await importOriginal<typeof overlay>();
  return { ...real, useDispatcherOverlayLayer: vi.fn(real.useDispatcherOverlayLayer) };
});

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frames = async (n: number) => {
  await act(async () => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
};

const order: string[] = [];
const layer = (id: string): RenderLayer<unknown> => ({
  id, label: id, space: 'screen', draw: () => { order.push(id); return []; },
});

function Canvas({ layers }: { layers: Record<string, unknown> }) {
  const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  return <SceneCanvas scene={scene} layers={layers as never} width={300} height={200} />;
}

describe('<SceneCanvas layers> dispatcherOverlay slot', () => {
  it('paints a pre-built dispatcherOverlay entry in place of its own', async () => {
    order.length = 0;
    render(<WeaselProvider><Canvas layers={{ dispatcherOverlay: { layer: layer('mine') } }} /></WeaselProvider>);
    await frames(2);
    expect(order).toContain('mine');
  });

  it("hands a dispatcherOverlay config's style to the layer it builds", () => {
    const style = { stroke: '#ff0000', roles: { cut: { paint: { color: '#00ff00' }, width: 2 } } };
    render(<WeaselProvider><Canvas layers={{ dispatcherOverlay: { style } }} /></WeaselProvider>);
    expect(vi.mocked(overlay.useDispatcherOverlayLayer).mock.lastCall?.[0].style).toBe(style);
  });
});
