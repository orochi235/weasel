import '../styles.less';
import './CameraInput.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ViewTransform } from '../instrument/types';
import { CameraContext, type CameraContextValue } from './CameraInput';
import { CanvasStack } from './CanvasStack';

// A stack under a scaled ancestor — a `<Stage>`, a lens — draws in its layout
// px, so its camera has to read the pointer in them too. Only a browser
// applies the transform to the client rect.

afterEach(cleanup);

function Grab({ into }: { into: { current: CameraContextValue | null } }) {
  into.current = useContext(CameraContext);
  return null;
}

function mountScaled(view: ViewTransform, onViewChange = vi.fn(), onHitTest = vi.fn()) {
  const camera: { current: CameraContextValue | null } = { current: null };
  const { container } = render(
    <div className="scaled-host">
      <CanvasStack
        layers={[]}
        view={view}
        onViewChange={onViewChange}
        onHitTest={onHitTest}
        width={200}
        height={100}
      >
        <Grab into={camera} />
      </CanvasStack>
    </div>,
  );
  const host = container.querySelector<HTMLElement>('.lk-canvas-stack');
  if (!host) throw new Error('no stack host');
  return { host, camera, onViewChange, onHitTest };
}

function pointer(host: HTMLElement, type: string, clientX: number, clientY: number): void {
  host.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerId: 1,
      isPrimary: true,
      clientX,
      clientY,
    }),
  );
}

test('a tap on a scaled stack lands on the layout point under the pointer', () => {
  const { host, onHitTest } = mountScaled({ zoom: 1, pan: { x: 0, y: 0 } });
  const r = host.getBoundingClientRect();
  expect(r.width).toBe(400);
  pointer(host, 'pointerdown', r.left + 100, r.top + 60);
  pointer(host, 'pointerup', r.left + 100, r.top + 60);
  expect(onHitTest).toHaveBeenCalledWith({ x: 50, y: 30 });
});

test("a scaled stack's camera reports its layout size", () => {
  const { camera } = mountScaled({ zoom: 1, pan: { x: 0, y: 0 } });
  expect(camera.current?.view.hostSize?.()).toEqual({ width: 200, height: 100 });
});

test('a wheel zoom on a scaled stack keeps the point under the pointer still', () => {
  const { host, onViewChange } = mountScaled({ zoom: 1, pan: { x: 0, y: 0 } });
  const r = host.getBoundingClientRect();
  // Layout (50, 30): world (50, 30) at zoom 1, pan 0.
  host.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      clientX: r.left + 100,
      clientY: r.top + 60,
    }),
  );
  const next = onViewChange.mock.calls.at(-1)?.[0] as ViewTransform | undefined;
  if (!next) throw new Error('the wheel changed no view');
  expect(next.zoom).toBeGreaterThan(1);
  expect(50 * next.zoom + next.pan.x).toBeCloseTo(50, 6);
  expect(30 * next.zoom + next.pan.y).toBeCloseTo(30, 6);
});
