/**
 * `diagramContainerLayout` — free placement under a header. A member stays
 * wherever it is dropped or the container is resized to; only the title is
 * placed, in the header.
 *
 * A strategy sees ids and poses, never data, so it cannot tell a lane from a
 * shape. Which nodes a container admits is `diagramCanDropInto`'s call.
 */
import { createTransformOp, type LayoutStrategy, type RectPose } from '@weasel-js/core';
import { titlePose } from './titlePose';
import { bodyBox, titleIdOf, type ContainerHeader } from './trait';

/** Options for {@link diagramContainerLayout}. */
export interface ContainerLayoutOptions {
  /** Where the title sits; matches the container trait's own `header`. */
  header?: ContainerHeader;
}

const center = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

/** The title's pose when it is not already there; nothing else is placed. */
export function titlePoses(
  container: { id: string; bounds: { x: number; y: number; width: number; height: number } },
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
    childPoses: (container, children) => titlePoses(container, children, header),
    getDropTargets: (_container, _children, dragged) => [{ pose: dragged.pose, origin: center(dragged.pose) }],
    reflowPoses: () => new Map(),
    commitDrop: (_container, _children, dragged, target) => [createTransformOp<RectPose>({
      id: dragged.id, from: dragged.originPose, to: target?.pose ?? dragged.pose, label: 'Drop',
    })],
    dropRegion(container) {
      const b = container.bounds;
      const body = bodyBox(b, header);
      return { kind: 'rect', x: body.x - b.x, y: body.y - b.y, width: body.width, height: body.height };
    },
  };
}
