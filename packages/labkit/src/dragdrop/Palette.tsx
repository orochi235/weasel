import type { PaletteItem, Point } from '../instrument/types';

export interface PaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem, originScreenPos: Point) => void;
  className?: string;
}

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
            onDragStart(item, { x: e.clientX, y: e.clientY });
          }}
        >
          <span className="lk-palette__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
