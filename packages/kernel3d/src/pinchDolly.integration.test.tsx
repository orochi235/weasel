/** `camera.pinchDolly` through the dispatcher: two touch pointers spreading dolly the camera in. */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useActionsRegistry, useDepRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { pinchDollyAction } from './tools';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function Mount({ dep }: { dep: Camera3dDep }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  const deps = useDepRegistry();
  deps.register('camera3d', () => dep);
  if (actions && !actions.list().some((a) => a.id === pinchDollyAction.id)) actions.register(pinchDollyAction);
  useGestureDispatcher({ canvasRef: ref, actions: actions!, entriesById: new Map() });
  return <canvas ref={ref} data-testid="canvas" />;
}

const touch = (type: string, pointerId: number, clientX: number) =>
  new PointerEvent(type, { bubbles: true, pointerId, pointerType: 'touch', clientX, clientY: 100 });

describe('camera.pinchDolly by touch', () => {
  it('dollies in when two fingers spread', () => {
    let camera: Camera3d = createCamera({ distance: 10 });
    const dep: Camera3dDep = { get: () => camera, set: (c) => { camera = c; }, size: () => ({ width: 400, height: 200 }) };
    const { getByTestId } = render(
      <DepRegistryProvider><ActiveToolContextProvider><ActionsProvider>
        <Mount dep={dep} />
      </ActionsProvider></ActiveToolContextProvider></DepRegistryProvider>,
    );
    const canvas = getByTestId('canvas');
    act(() => {
      canvas.dispatchEvent(touch('pointerdown', 1, 100));
      canvas.dispatchEvent(touch('pointerdown', 2, 200));
    });
    act(() => { canvas.dispatchEvent(touch('pointermove', 2, 300)); });
    expect(camera.distance).toBeLessThan(10);
  });
});
