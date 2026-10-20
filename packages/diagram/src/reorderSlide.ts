/**
 * The `'slide'` look of a reorder: the carried item under the pointer and the
 * others in the places they would take, published as pose overrides so
 * everything that derives its pose from them follows.
 */
import { effectivePose, type NodeId, type Scene } from '@weasel-js/core';
import type { ReorderSlots } from './reorder';

export type Box = { x: number; y: number; width: number; height: number };

/** Where an item stands along the axis: its start and its length. */
interface Span {
  start: number;
  size: number;
}

/**
 * Where each item starts along the axis once they stand in `order`: packed
 * from where the first stood, each gap kept at its place in the row.
 */
function packed(items: readonly string[], spans: ReadonlyMap<string, Span>, order: readonly string[]): Map<string, number> {
  const gaps = items.slice(1).map((m, i) => spans.get(m)!.start - (spans.get(items[i]!)!.start + spans.get(items[i]!)!.size));
  const out = new Map<string, number>();
  let at = items.length > 0 ? spans.get(items[0]!)!.start : 0;
  order.forEach((m, i) => {
    out.set(m, at);
    at += spans.get(m)!.size + (gaps[i] ?? gaps[gaps.length - 1] ?? 0);
  });
  return out;
}

const RELEASE_MS = 500;

/** Slides `slots`' items around `carried` until dropped, or kept past a commit. */
export function slideOthers(scene: Scene<unknown, string, unknown>, slots: ReorderSlots, carried: string) {
  const { axis } = slots;
  const size = axis === 'x' ? 'width' : 'height';
  const ids = slots.items.map((i) => i.id);
  const spans = new Map(slots.items.map((i) => [i.id, { start: i.bounds[axis], size: i.bounds[size] }]));
  // Nodes that derive their pose follow the ones that hold theirs.
  const nodes = slots.items.map((item) => ({
    id: item.id,
    poses: (item.carries ?? [item.id]).flatMap((id) => {
      const node = scene.get(id as NodeId);
      return node === undefined || node.derivePose !== undefined ? [] : [{ id: id as NodeId, pose: effectivePose(scene, node) as Box }];
    }),
  }));
  const hold = scene.overrides.hold();
  return {
    /** The items standing in `order`, or as they were for `null`, with the carried one `by` along. */
    show(order: readonly string[] | null, by: number): void {
      const starts = packed(ids, spans, order ?? ids);
      hold.set(nodes.flatMap(({ id, poses }) => {
        const d = id === carried ? by : starts.get(id)! - spans.get(id)!.start;
        return poses.map(({ id: node, pose }) => [node, { ...pose, [axis]: pose[axis] + d }] as const);
      }));
    },
    drop: () => hold.drop(),
    /** Held until the host's new specs land, so the items do not jump back for
     *  the frames in between; a host that keeps the old order gets it back shortly after. */
    keep(): void {
      const release = () => {
        stop();
        clearTimeout(timer);
        hold.drop();
      };
      const stop = scene.subscribe(release);
      const timer = setTimeout(release, RELEASE_MS);
    },
  };
}
