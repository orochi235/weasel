/**
 * Where nodes draw once a set of poses is written: each node's stored pose,
 * or the one `frame` gives it, folded through every container's frame. A node
 * a moving container carries moves with it though `frame` does not name it.
 */
import { composeWorldPose, definesFrame, type AnyScene } from '@weasel-js/core';

type AnyNode = NonNullable<ReturnType<AnyScene['get']>>;

/** `(id) => where it draws` with `frame`'s poses in place of the ones `read`
 *  takes off each node, by default the stored pose. */
export function worldWith(
  sc: AnyScene,
  frame: ReadonlyMap<string, unknown> = new Map(),
  read: (node: AnyNode) => unknown = (node) => node.pose,
): (id: string) => unknown {
  const poses = {
    getPose: (id: string) => (frame.has(id) ? frame.get(id) : read(sc.get(id as never)!)),
    getParent: (id: string) => (sc.get(id as never)?.parent ?? null) as string | null,
    definesFrame: (id: string) => {
      const n = sc.get(id as never);
      return n === undefined || definesFrame(n);
    },
  };
  return (id) => composeWorldPose(poses, id, sc.composition.compose);
}
