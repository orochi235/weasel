import { DragGhost as UiDragGhost } from '@weasel-js/ui/components/DragGhost';
import type { PaletteItem, Point } from '../instrument/types';

/** Props for `DragGhost`. `screenPos` is in client pixels. */
export interface DragGhostProps {
  item: PaletteItem;
  screenPos: Point;
  /** The element the drag began on; the ghost takes its theme and font. */
  from: Element;
}

/** The dragged item's label, just below-right of `screenPos`. */
export function DragGhost({ item, screenPos, from }: DragGhostProps) {
  return (
    <UiDragGhost at={{ left: screenPos.x + 12, top: screenPos.y + 12 }} from={from}>
      <span className="lk-drag-ghost">{item.label}</span>
    </UiDragGhost>
  );
}
