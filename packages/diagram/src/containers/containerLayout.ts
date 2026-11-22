/**
 * `diagramContainerLayout` — free placement under a header. A member stays
 * wherever it is dropped or the container is resized to; only the title is
 * placed, in the header.
 *
 * The header is the container trait's own where the layout is handed the
 * container's node. Which nodes a container admits is `diagramCanDropInto`'s call.
 */
import { type LayoutStrategy, type RectPose } from '@weasel-js/core';
import { titlePose } from './titlePose';
import { bodyBox, layoutHeaderOf, titleIdOf, type ContainerHeader } from './trait';
import type { Rect } from '@weasel-js/geom';
import * as ops from '@weasel-js/core/ops';

/** Options for {@link diagramContainerLayout}. */
export interface ContainerLayoutOptions {
  /** Where the title sits in a container whose node carries no header. */
  header?: ContainerHeader;
}

const center = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

/** The title's pose when it is not already there; nothing else is placed. */
export function titlePoses(
  container: { id: string; bounds: Rect },
  children: readonly { id: string; pose: RectPose }[],
  header: ContainerHeader | undefined,
): Map<string, RectPose> {
  const out = new Map<string, RectPose>();
  const title = children.find((c) => c.id === titleIdOf(container.id));
  if (title !== undefined) out.set(title.id, titlePose(container.bounds, header));
  return out;
}

/** A free-placement layout whose drops land in the body below or beside `header`. */
export function diagramContainerLayout(opts: ContainerLayoutOptions = {}): LayoutStrategy<RectPose> {
  const { header } = opts;
  return {
    snap: { pickTarget: (targets) => targets[0] ?? null },
    childPoses: (container, children) => titlePoses(container, children, layoutHeaderOf(container, header)),
    getDropTargets: (_container, _children, dragged) => [{ pose: dragged.pose, origin: center(dragged.pose) }],
    reflowPoses: () => new Map(),
    commitDrop: (_container, _children, dragged, target) => [ops.setPose<RectPose>({
      id: dragged.id, from: dragged.originPose, to: target?.pose ?? dragged.pose, label: 'Drop',
    })],
    dropRegion(container) {
      const b = container.bounds;
      const body = bodyBox(b, layoutHeaderOf(container, header));
      return { kind: 'rect', x: body.x - b.x, y: body.y - b.y, width: body.width, height: body.height };
    },
  };
}
