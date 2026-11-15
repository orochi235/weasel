import type { SurfaceContribution } from '@weasel-js/core';
import type { Action, BoundGesture } from '@weasel-js/routing';
import {
  DOLLY_MOD_WHEEL, DOLLY_PINCH, DOLLY_TRACKPAD_PINCH, DOLLY_WHEEL, HOME_DOUBLE_CLICK, ORBIT_DRAG, PAN_DRAG,
  PINCH_DOLLY_TOUCH,
} from './cameraBindings';
import type { Camera3dDep } from './cameraDep';
import { dollyAction, homeAction, orbitAction, panAction, pinchDollyAction } from './tools';

/** Which gestures an orbit camera's rig binds. Each one left off reaches whatever is under the camera. */
export interface CameraRigGestures {
  /** A drag orbits and Shift+drag pans. Default `false`: on a `<SceneCanvas>`, `useOrbitTool` binds those. */
  drag?: boolean;
  /** The wheel dollies: `'plain'` a bare wheel, `'mod'` only with Cmd/Ctrl held, `false` never. Default `'plain'`. */
  wheel?: 'plain' | 'mod' | false;
  /** A trackpad pinch dollies: ctrl+wheel, and WebKit's gesture events. Default `true`. */
  trackpadPinch?: boolean;
  /** Two fingers on a touch screen dolly. Default `true`. */
  touchPinch?: boolean;
  /** A double click returns the camera to the dep's `home`. Default `true`. */
  home?: boolean;
}

/** Options for {@link cameraRig}. */
export interface CameraRigOptions extends CameraRigGestures {
  /** The entry's id among the surface's contributions. Default `'camera3d'`. */
  id?: string;
}

function bind(action: Action, bindings: readonly (BoundGesture | false)[]): Action[] {
  const on = bindings.filter((b): b is BoundGesture => b !== false);
  return on.length > 0 ? [{ ...action, defaultBinding: on }] : [];
}

/**
 * kernel3d's camera actions, each carrying the default bindings `gestures` turns on, for any registry a
 * dispatcher reads: `cameraRig`'s ambient entry, or an `ActionsRegistry` under a `useGestureDispatcher` of
 * the host's own. An action none of whose gestures is on is left out. Every action reads the `camera3d` dep.
 */
export function cameraRigActions(gestures: CameraRigGestures = {}): Action[] {
  const { drag = false, wheel = 'plain', trackpadPinch = true, touchPinch = true, home = true } = gestures;
  return [
    ...bind(orbitAction, [drag && ORBIT_DRAG]),
    ...bind(panAction, [drag && PAN_DRAG]),
    ...bind(dollyAction, [
      wheel === 'plain' && DOLLY_WHEEL,
      wheel === 'mod' && DOLLY_MOD_WHEEL,
      trackpadPinch && DOLLY_TRACKPAD_PINCH,
      trackpadPinch && DOLLY_PINCH,
    ]),
    ...bind(pinchDollyAction, [touchPinch && PINCH_DOLLY_TOUCH]),
    ...bind(homeAction, [home && HOME_DOUBLE_CLICK]),
  ];
}

/**
 * The ambient entry that puts an orbit camera on a `<SceneCanvas>`: the `camera3d` dep, and
 * {@link cameraRigActions} for `opts`. By default those are the camera actions the orbit tool does not
 * carry — the wheel and trackpad dolly, the two-finger pinch, and the double-click home, which passes when
 * the dep has no `home`.
 *
 * ```tsx
 * const rig = useMemo(() => cameraRig(createCameraDep(world, { set: setCamera })), [world]);
 * <SceneCanvas tools={{ orbit: useOrbitTool() }} ambient={[rig]} … />
 * ```
 */
export function cameraRig(camera3d: Camera3dDep, opts: CameraRigOptions = {}): SurfaceContribution {
  const { id = 'camera3d', ...gestures } = opts;
  return {
    id,
    eligibility: { always: true },
    actions: cameraRigActions(gestures),
    deps: { camera3d: () => camera3d },
  };
}
