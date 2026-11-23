import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PaletteItem } from '../instrument/types';

/** Props for `Palette`. `onDragStart` and `onPlace` are usually `useDragDrop`'s `startDrag` and `place`. */
export interface PaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem, e: ReactPointerEvent) => void;
  /** Places an item without a drag, when its button is pressed from the keyboard. */
  onPlace?: (item: PaletteItem) => void;
  className?: string;
}

/** One button per item, each starting a drag on pointerdown and calling `onPlace` when activated by Enter or Space. */
export function Palette({ items, onDragStart, onPlace, className }: PaletteProps) {
  return (
    <div className={className ? `lk-palette ${className}` : 'lk-palette'}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className="lk-palette__item"
          onPointerDown={(e) => {
            e.preventDefault();
            onDragStart(item, e);
          }}
          // A click with no pointer behind it (`detail` 0) is the keyboard's.
          onClick={(e) => {
            if (e.detail === 0) onPlace?.(item);
          }}
        >
          <span className="lk-palette__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
