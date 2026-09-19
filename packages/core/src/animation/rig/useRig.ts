import { useEffect, useMemo } from 'react';
import { bindRig, type BindRigOptions, type Rig } from './bindRig';

/**
 * A {@link Rig} bound for the component's lifetime, its overrides dropped on
 * unmount. Rebinds — re-reading every node's rest pose — whenever an option's
 * identity changes, so hoist or memoize `skeleton` and `bindings`.
 */
export function useRig<TPose>(options: BindRigOptions<TPose>): Rig {
  const { scene, skeleton, bindings, apply, descriptor } = options;
  const rig = useMemo(
    () => bindRig({ scene, skeleton, bindings, apply, descriptor }),
    [scene, skeleton, bindings, apply, descriptor],
  );
  useEffect(() => () => rig.release(), [rig]);
  return rig;
}
