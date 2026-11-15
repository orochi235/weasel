import type { SurfaceContribution } from '@weasel-js/core';
import type { Camera3dDep } from './cameraDep';
import { dollyAction, homeAction, pinchDollyAction } from './tools';

/** Options for {@link cameraRig}. */
export interface CameraRigOptions {
  /** The entry's id among the surface's contributions. Default `'camera3d'`. */
  id?: string;
}

/**
 * The ambient entry that puts an orbit camera on a `<SceneCanvas>`: the `camera3d` dep, and the
 * camera actions the orbit tool does not carry — the wheel and trackpad dolly, the two-finger
 * pinch, and the double-click home, which passes when the dep has no `home`.
 *
 * ```tsx
 * const rig = useMemo(() => cameraRig(createCameraDep(world, { set: setCamera })), [world]);
 * <SceneCanvas tools={{ orbit: useOrbitTool() }} ambient={[rig]} … />
 * ```
 */
export function cameraRig(camera3d: Camera3dDep, opts: CameraRigOptions = {}): SurfaceContribution {
  return {
    id: opts.id ?? 'camera3d',
    eligibility: { always: true },
    actions: [dollyAction, pinchDollyAction, homeAction],
    deps: { camera3d: () => camera3d },
  };
}
