/** What `<MinimapCanvas>` frames: a press at its center recenters the main view on the center of its fit. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, createEvent, fireEvent, render } from '@testing-library/react';
import { createScene } from '@weasel-js/core';
import type { DrawCommand, Scene, SceneViewLayers, View } from '@weasel-js/core';
import { MinimapCanvas } from './MinimapCanvas';

vi.mock('@weasel-js/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  WeaselRenderer: class {
    render(): void {}
    lastFrameStats() { return { retained: { composited: 0, declined: 0 } }; }
    resize(): void {}
    dispose(): void {}
  },
}));

beforeEach(() => {
  cleanup();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  const fakeGl = { enable: () => {} } as unknown as WebGL2RenderingContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' ? fakeGl : null;
  }) as HTMLCanvasElement['getContext'];
});

type P = { x: number; y: number; width: number; height: number };
type L = 'main' | 'notes';
const drawOne = (): DrawCommand[] => [];
const MAIN_DIMS = { width: 200, height: 200 };

function makeScene(): Scene<object, L, P> {
  const s = createScene<object, L, P>({ systemLayers: [{ id: 'main' }, { id: 'notes' }] });
  s.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 } });
  s.add({ kind: 'mark', data: {}, layer: 'notes', pose: { x: 4900, y: 0, width: 100, height: 100 } });
  return s;
}

/** The main view's center after a press at the minimap's own center. */
function pressCenter(scene: Scene<object, L, P>, layerVisibility?: SceneViewLayers['layerVisibility']) {
  const onChange = vi.fn();
  const { container } = render(
    <MinimapCanvas
      scene={scene} mainView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }} mainViewDims={MAIN_DIMS}
      onMainViewChange={onChange} width={100} height={100} drawOne={drawOne}
      {...(layerVisibility ? { layerVisibility } : {})}
    />,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  const ev = createEvent.pointerDown(canvas, { pointerId: 1 });
  Object.defineProperty(ev, 'clientX', { value: 50 });
  Object.defineProperty(ev, 'clientY', { value: 50 });
  fireEvent(canvas, ev);
  const v = onChange.mock.calls[0][0] as View;
  return { x: v.x + MAIN_DIMS.width / 2 / v.scale.x, y: v.y + MAIN_DIMS.height / 2 / v.scale.y };
}

describe('<MinimapCanvas> fit', () => {
  it('frames every layer it paints', () => {
    expect(pressCenter(makeScene()).x).toBeCloseTo(2500, 6);
  });

  it('leaves out a layer its layerVisibility hides', () => {
    expect(pressCenter(makeScene(), { 'scene:notes': false }).x).toBeCloseTo(50, 6);
  });
});
