/** `cameraRig` on a `<SceneCanvas>`: the wheel dollies the camera it was handed. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import { cameraRig } from './cameraRig';
import { createNestedTestScene } from './testScene';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

describe('cameraRig', () => {
  it('registers the camera actions under its own id', () => {
    const rig = cameraRig({ get: () => createCamera({}), set: () => {}, size: () => ({ width: 1, height: 1 }) }, { id: 'rig' });
    expect(rig.id).toBe('rig');
    expect(rig.actions?.map((a) => a.id)).toEqual(['camera.dolly', 'camera.pinchDolly', 'camera.home']);
  });

  it('dollies its camera on a wheel', () => {
    const { scene } = createNestedTestScene();
    let camera: Camera3d = createCamera({ distance: 10 });
    const rig = cameraRig({ get: () => camera, set: (c) => { camera = c; }, size: () => ({ width: 400, height: 300 }) });
    const { container } = render(<SceneCanvas scene={scene} layers={{}} width={400} height={300} ambient={[rig]} />);
    const canvas = container.querySelector('canvas')!;
    act(() => { canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 200, clientY: 150 })); });
    expect(camera.distance).toBeLessThan(10);
  });
});
