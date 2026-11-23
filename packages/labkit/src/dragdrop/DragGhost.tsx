import { DragGhost as UiDragGhost } from '@weasel-js/ui/components/DragGhost';
import type { PaletteItem, Point } from '../instrument/types';

/** Props for `DragGhost`. `screenPos` is in client pixels. */
export interface DragGhostProps {
  item: PaletteItem;
  screenPos: Point;
  /** The element the drag began on; the ghost takes its theme and font. */
  from: Element;
  /** Why a drop here would be refused, shown under the label. */
  reason?: string;
}

/** The dragged item's label, just below-right of `screenPos`, and `reason` under it when given. */
export function DragGhost({ item, screenPos, from, reason }: DragGhostProps) {
  return (
    <UiDragGhost at={{ left: screenPos.x + 12, top: screenPos.y + 12 }} from={from}>
      <span className="lk-drag-ghost">
        {item.label}
        {reason ? <span className="lk-drag-ghost__reason">{reason}</span> : null}
      </span>
    </UiDragGhost>
  );
}
