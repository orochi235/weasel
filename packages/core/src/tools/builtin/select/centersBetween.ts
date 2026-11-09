import { boundsOfPath } from '@weasel-js/geom';
import { pickWalk, type AdapterPickGates, type PickCandidate, type PickSource } from 'canvas/pickWalk';
import { adapterPickSource } from 'canvas/adapterPickSource';
import { poseDescriptorForNode, visualBoundsViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** The adapter reads `centersBetween` walks: a tree and each node's world pose. */
type SpanAdapter<TPose> = Parameters<typeof adapterPickSource<TPose>>[0];

/**
 * A range for the select tool over a bare adapter: every node a pick can reach whose center
 * lies in the box `from` and `to` span, as each is drawn in world (turned and framed), in paint
 * order. Empty when either end is not reachable.
 */
export function centersBetween<TPose>(
  adapter: SpanAdapter<TPose>,
  descriptor: PoseDescriptor<TPose>,
  gates: AdapterPickGates = {},
): (from: string, to: string) => string[] {
  return centersAmong(() => adapterPickSource(adapter, gates), descriptor);
}

/** {@link centersBetween} over any pick source, so a range passes over what that source's walk
 *  does: a scene's locked and hidden layers among them. */
export function centersAmong<TPose>(
  source: () => PickSource<TPose>,
  descriptor: PoseDescriptor<TPose>,
): (from: string, to: string) => string[] {
  return (from, to) => {
    const boxes = new Map<string, Bounds>();
    const ids = pickWalk<TPose>(source(), {
      hits: (node: PickCandidate<TPose>, pose: TPose, derived) => {
        boxes.set(node.id, derived ? boundsOfPath(derived) : visualBoundsViaDescriptor(pose, poseDescriptorForNode(descriptor, node)));
        return true;
      },
      clipAdmits: () => true,
    });
    const a = boxes.get(from);
    const b = boxes.get(to);
    if (!a || !b) return [];
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x + a.width, b.x + b.width), y1 = Math.max(a.y + a.height, b.y + b.height);
    return ids.filter((id) => {
      const r = boxes.get(id)!;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
  };
}
