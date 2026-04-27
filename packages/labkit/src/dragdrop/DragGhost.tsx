import { type ReactPortal, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PaletteItem, Point } from '../instrument/types';

export interface DragGhostProps {
  item: PaletteItem;
  screenPos: Point;
}

export function DragGhost({ item, screenPos }: DragGhostProps): ReactPortal | null {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  const style = {
    left: `${screenPos.x + 12}px`,
    top: `${screenPos.y + 12}px`,
  };
  return createPortal(
    <div className="lk-drag-ghost" style={style}>
      <span className="lk-drag-ghost__label">{item.label}</span>
    </div>,
    document.body,
  );
}
