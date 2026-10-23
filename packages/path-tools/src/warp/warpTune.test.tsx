import { describe, expect, it, vi, beforeAll } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { polygonFromPoints } from '@weasel-js/geom';
import type { ActionTunings } from '@weasel-js/routing';
import {
  asNodeId, type CanvasExtensionApi, type ChromeState, createScene, type RenderLayer, SceneCanvas,
} from '@weasel-js/core';
import { useEnvelopeTool, type UseEnvelopeToolOptions } from './useWarpTool';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** How many draw commands the envelope tool's controls paint over a selected
 *  path holding no warp, made with `options` under `tune`. */
function controlsDrawn(options: UseEnvelopeToolOptions, tune: ActionTunings = {}): number {
  const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const square = polygonFromPoints([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }]);
  scene.add({ id: asNodeId('a'), kind: 'mark', data: { path: square }, layer: 'main', pose: { x: 0, y: 0, width: 60, height: 60 } });
  const tool = renderHook(() => useEnvelopeTool(options)).result.current;
  let layer: RenderLayer<unknown> | null = null;
  const attach = tool.attach!;
  const watched = Object.assign(tool, {
    attach: (api: CanvasExtensionApi, deps: Parameters<typeof attach>[1]) => attach(
      Object.assign(Object.create(api) as CanvasExtensionApi, {
        registerLayer: (l: RenderLayer<unknown>) => { layer = l; return api.registerLayer(l); },
      }),
      deps,
    ),
  });
  render(
    <SceneCanvas
      features={['paths']} scene={scene} layers={{}} width={64} height={64}
      selectionOptions={{ mode: 'multi', initial: [asNodeId('a')] }}
      tools={{ envelope: watched }}
      tune={tune}
    />,
  );
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true, bubbles: true })); });
  const state = { selection: [asNodeId('a')], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: {} } as unknown as ChromeState;
  return (layer as RenderLayer<unknown> | null)?.draw(state, VIEW as never, { width: 64, height: 64 }).length ?? 0;
}

describe('a warp tool tuned through <SceneCanvas tune>', () => {
  it('draws a fresh mesh at the size its drag would make', () => {
    const fromOptions = controlsDrawn({ rows: 4, cols: 4 });
    expect(fromOptions).toBeGreaterThan(controlsDrawn({}));
    expect(controlsDrawn({}, { 'envelope.drag': { params: { rows: 4, cols: 4 } } })).toBe(fromOptions);
  });
});
