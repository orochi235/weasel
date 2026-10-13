import { useEffect, useMemo } from 'react';
import { bindRigOn, type BindRigOptions, type Rig } from './bindRig';
import { createRigSeat, seatBinding, type RigSeat } from './rigSeat';

/**
 * A {@link Rig} bound for the component's lifetime, its overrides dropped on
 * unmount. Rebinds — re-reading every node's rest pose — whenever an option's
 * identity changes, so hoist or memoize `skeleton`, `bindings`, and `skins`.
 */
export function useRig<TPose>(options: BindRigOptions<TPose>): Rig {
  return useSeatedRig(options, null);
}

/** {@link useRig} on a seat that outlives a rebind; `null` makes a seat for each binding. */
export function useSeatedRig<TPose>(options: BindRigOptions<TPose>, kept: RigSeat | null): Rig {
  const { scene, skeleton, bindings, skins, restPath, apply, descriptor } = options;
  const made = useMemo(() => {
    const seat = kept ?? createRigSeat(skeleton);
    const bound = bindRigOn({ scene, skeleton, bindings, skins, restPath, apply, descriptor }, seat);
    seat.binding ??= bound.binding;
    return { seat, ...bound };
  }, [scene, skeleton, bindings, skins, restPath, apply, descriptor, kept]);
  useEffect(() => {
    seatBinding(made.seat, made.binding);
    return () => made.binding.drop();
  }, [made]);
  return made.rig;
}
