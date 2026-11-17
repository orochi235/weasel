/** `cameraRig` on a `<SceneCanvas>`: the wheel dollies the camera it was handed. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import { cameraRig, createCameraRigActions } from './cameraRig';
import { createNestedTestScene } from './testScene';
import type { Action } from '@weasel-js/routing';

/** Each action's id, with the specs its default bindings take. */
function bound(actions: readonly Action[]) {
  return actions.map((a) => {
    const d = a.defaultBinding;
    return [a.id, Array.isArray(d) ? d.map((b) => ('spec' in b ? b.spec : b)) : d ? [d] : []];
  });
}

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

  it('carries the actions createCameraRigActions builds from the same options', () => {
    const dep = { get: () => createCamera({}), set: () => {}, size: () => ({ width: 1, height: 1 }) };
    const opts = { drag: true, wheel: 'mod', touchPinch: false } as const;
    expect(bound(cameraRig(dep, opts).actions ?? [])).toEqual(bound(createCameraRigActions(opts)));
  });
});

describe('createCameraRigActions', () => {
  it('binds the wheel, both pinches and the double click by default, and no drag', () => {
    expect(bound(createCameraRigActions())).toEqual([
      ['camera.dolly', [{ kind: 'wheel' }, { kind: 'wheel', mods: { ctrl: true } }, { kind: 'pinch' }]],
      ['camera.pinchDolly', [{ kind: 'multiTouch', fingers: 2 }]],
      ['camera.home', [{ kind: 'doubleClick' }]],
    ]);
  });

  it('orbits on a drag and pans on Shift+drag when asked to', () => {
    expect(bound(createCameraRigActions({ drag: true })).slice(0, 2)).toEqual([
      ['camera.orbit', [{ kind: 'drag' }]],
      ['camera.pan', [{ kind: 'drag', mods: { shift: true } }]],
    ]);
  });

  it('dollies on Mod+wheel, or leaves the wheel alone', () => {
    expect(bound(createCameraRigActions({ wheel: 'mod', trackpadPinch: false }))[0])
      .toEqual(['camera.dolly', [{ kind: 'wheel', mods: { mod: true } }]]);
    expect(bound(createCameraRigActions({ wheel: false })).find(([id]) => id === 'camera.dolly'))
      .toEqual(['camera.dolly', [{ kind: 'wheel', mods: { ctrl: true } }, { kind: 'pinch' }]]);
  });

  it('leaves out an action whose every gesture is off', () => {
    const ids = createCameraRigActions({ wheel: false, trackpadPinch: false, touchPinch: false, doubleClick: false })
      .map((a) => a.id);
    expect(ids).toEqual([]);
  });
});
