import { describe, expect, it, vi, beforeAll } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { polygonFromPoints } from '@weasel-js/geom';
import { asNodeId, createScene, SceneCanvas, type ToolsApi } from '@weasel-js/core';
import { useDistortTool } from './useWarpTool';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = vi.fn(() => null);
});

/** The selected square's height after a drag on its top resize handle, with `toolId` active. */
function heightAfterTopHandleDrag(toolId: 'select' | 'distort'): number {
  const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const square = polygonFromPoints([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }]);
  scene.add({ id: asNodeId('a'), kind: 'mark', data: { path: square }, layer: 'main', pose: { x: 0, y: 0, width: 60, height: 60 } });
  const distort = renderHook(() => useDistortTool()).result.current;
  const tools: { current?: ToolsApi } = {};
  const { container } = render(
    <SceneCanvas
      features={['draw']} scene={scene} layers={{}} width={128} height={128}
      selectionOptions={{ mode: 'multi', initial: [asNodeId('a')] }}
      tools={{ distort }} onToolsCreated={(t) => { tools.current = t; }}
    />,
  );
  act(() => tools.current!.setActive(toolId));
  const canvas = container.querySelector('canvas')!;
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
  act(() => {
    at('pointerdown', 30, 0);
    at('pointermove', 30, -10);
    at('pointermove', 30, -20);
    at('pointerup', 30, -20);
  });
  return (scene.get(asNodeId('a'))!.pose as P).height;
}

describe("a warp tool and the selection's transform handles", () => {
  it('leaves the resize handles to the select tool', () => {
    expect(heightAfterTopHandleDrag('select')).toBeGreaterThan(60);
  });

  it('hides them, so their hit areas no longer resize', () => {
    expect(heightAfterTopHandleDrag('distort')).toBe(60);
  });
});
