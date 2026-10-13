import type { HTMLAttributes } from 'react';
import type { NodeId } from 'windease';
import { useDragHandle } from 'windease/react';
import { useTrialDrag } from '../trial/TrialDragContext';

/** Props for `<TileGrip>`: those of the `div` it renders. */
export type TileGripProps = HTMLAttributes<HTMLDivElement>;

// `useDragHandle` needs a node id and windease's DragProvider, so the draggable
// form is a separate component rather than a conditional hook.
function Draggable({
  nodeId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...rest
}: TileGripProps & { nodeId: NodeId }) {
  const handle = useDragHandle(nodeId);
  return (
    <div
      {...rest}
      data-lk-tile-grip=""
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) handle.onPointerDown(event);
      }}
      // The handle tracks the drop target from its own move events, and ignores
      // the three below unless its press began a drag.
      onPointerMove={(event) => {
        onPointerMove?.(event);
        handle.onPointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        handle.onPointerUp(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        handle.onPointerCancel(event);
      }}
    />
  );
}

/**
 * The part of a `<Workspace reorderable>` tile a drag starts from: a `div`
 * that picks its tile up when dragged, and reports the drop through the
 * workspace's `onReorder`. Put it around a tile's own header, or anything else
 * that reads as the tile's handle; a `<Trial>`'s title bar is one already. A
 * press on a control inside still reaches the control, and an `onPointerDown`
 * that calls `preventDefault()` keeps that press from starting a drag.
 *
 * Outside a reorderable workspace it is a plain `div`, so a tile need not know
 * whether it can be moved. While it can, the element carries
 * `data-lk-tile-grip`.
 */
export function TileGrip(props: TileGripProps) {
  const drag = useTrialDrag();
  if (drag) return <Draggable nodeId={drag.nodeId} {...props} />;
  return <div {...props} />;
}
