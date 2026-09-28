import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PaletteItem } from '../instrument/types';

/** Props for `Palette`. `onDragStart` is usually `useDragDrop`'s `startDrag`. */
export interface PaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem, e: ReactPointerEvent) => void;
  className?: string;
}

/** One button per item, each starting a drag on pointerdown. */
export function Palette({ items, onDragStart, className }: PaletteProps) {
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
        >
          <span className="lk-palette__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
