import type { Op } from './types';
import type { LayoutStrategy } from '../../layout/types';
import { registerOpFactory } from './registry';

/** A container's layout as an op names it: the strategy itself, its key in
 *  the scene's `SceneRegistry.layout`, or `null` for none. */
export type LayoutRef<TPose = unknown> = LayoutStrategy<TPose> | string | null;

interface SetLayoutAdapter<TPose> {
  setLayout(id: string, layout: LayoutRef<TPose>): void;
}

/** Arguments to {@link createSetLayoutOp}: swap container `id`'s layout
 *  `from` → `to`. */
export interface SetLayoutArgs<TPose = unknown> {
  id: string;
  from: LayoutRef<TPose>;
  to: LayoutRef<TPose>;
  label?: string;
}

/**
 * Op: give a container a different layout, inverting back to `from`. Applied
 * through a scene adapter (`adapter.setLayout`), the scene re-arranges the
 * container under the new layout in the same undo step.
 *
 * A strategy object cannot be serialized, so an op that has to survive a
 * persisted history names its layouts by registry key.
 */
export function createSetLayoutOp<TPose = unknown>(args: SetLayoutArgs<TPose>): Op {
  const { id, from, to, label } = args;
  return {
    name: 'setLayout',
    args: { id, from, to, label },
    label: label ?? 'Set layout',
    apply(adapter) {
      (adapter as SetLayoutAdapter<TPose>).setLayout(id, to);
    },
    invert() {
      return createSetLayoutOp<TPose>({ id, from: to, to: from, label });
    },
  };
}

registerOpFactory<SetLayoutArgs>('setLayout', (args) => createSetLayoutOp(args));
