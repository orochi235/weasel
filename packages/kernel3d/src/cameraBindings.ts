/** The default bindings of kernel3d's camera actions, one each, for the actions and the rig to share. */
import type { BoundGesture } from '@weasel-js/routing';

export const ORBIT_DRAG: BoundGesture = { spec: { kind: 'drag' }, opts: { id: 'camera.orbit.drag' } };
export const PAN_DRAG: BoundGesture = { spec: { kind: 'drag', mods: { shift: true } }, opts: { id: 'camera.pan.drag' } };
export const DOLLY_WHEEL: BoundGesture = { spec: { kind: 'wheel' }, opts: { id: 'camera.dolly.wheel' } };
export const DOLLY_MOD_WHEEL: BoundGesture = { spec: { kind: 'wheel', mods: { mod: true } }, opts: { id: 'camera.dolly.modWheel' } };
/** Unbound, a trackpad pinch zooms the page instead. */
export const DOLLY_TRACKPAD_PINCH: BoundGesture = {
  spec: { kind: 'wheel', mods: { ctrl: true } }, opts: { id: 'camera.dolly.trackpadPinch' },
};
export const DOLLY_PINCH: BoundGesture = { spec: { kind: 'pinch' }, opts: { id: 'camera.dolly.pinch' } };
export const PINCH_DOLLY_TOUCH: BoundGesture = {
  spec: { kind: 'multiTouch', fingers: 2 }, opts: { id: 'camera.pinchDolly.multiTouch' },
};
export const HOME_DOUBLE_CLICK: BoundGesture = { spec: { kind: 'doubleClick' }, opts: { id: 'camera.home.doubleClick' } };
