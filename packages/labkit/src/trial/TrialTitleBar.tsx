import type { ReactNode } from 'react';
import type { NodeId } from 'windease';
import { useDragHandle } from 'windease/react';
import { useTrialDrag } from './TrialDragContext';

/** Props for `<TrialTitleBar>`. */
export interface TrialTitleBarProps {
  title: string;
  children?: ReactNode;
}

// `useDragHandle` needs a node id and windease's DragProvider, so the draggable
// form is a separate component rather than a conditional hook.
function Draggable({ nodeId, title, children }: TrialTitleBarProps & { nodeId: NodeId }) {
  const handlers = useDragHandle(nodeId);
  return (
    <div className="lk-trial__titlebar lk-trial__titlebar--draggable" {...handlers}>
      <span className="lk-trial__title">{title}</span>
      {children}
    </div>
  );
}

/** A trial's title bar. When the workspace allows reordering the whole bar is
 *  the drag surface — there is no separate grip, because a window's title bar
 *  is already the thing you expect to drag. */
export function TrialTitleBar({ title, children }: TrialTitleBarProps) {
  const drag = useTrialDrag();
  if (drag)
    return (
      <Draggable nodeId={drag.nodeId} title={title}>
        {children}
      </Draggable>
    );
  return (
    <div className="lk-trial__titlebar">
      <span className="lk-trial__title">{title}</span>
      {children}
    </div>
  );
}
