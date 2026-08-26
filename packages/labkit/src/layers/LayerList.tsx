import { type PointerEvent, useRef, useState } from 'react';
import type { LayerDescriptor } from '../instrument/types';

/** Props for `<LayerList>`. */
export interface LayerListProps {
  layers: LayerDescriptor[];
  visibility: Record<string, boolean>;
  onReorder: (newOrder: LayerDescriptor[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  className?: string;
}

interface DragState {
  pointerId: number;
  fromIndex: number;
  startY: number;
  /** Row height plus row gap, measured when the drag starts. */
  pitch: number;
}

/** A reorderable list of layers with per-layer visibility toggles. Layers
 *  marked `alwaysOn` are pinned and cannot be reordered or hidden. */
export function LayerList({ layers, visibility, onReorder, onToggle, className }: LayerListProps) {
  const reorderable = layers.filter((l) => !l.alwaysOn);
  const pinned = layers.filter((l) => l.alwaysOn);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  if (layers.length === 0) {
    return (
      <div className={className ? `lk-layer-list ${className}` : 'lk-layer-list'}>
        <div className="lk-layer-list__empty">No layers</div>
      </div>
    );
  }

  const startDrag = (e: PointerEvent<HTMLElement>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // Measured at grab time rather than hardcoded: a restyle that changes row
    // height or gap would otherwise silently skew every drag distance.
    const row = e.currentTarget.closest('.lk-layer-list__row');
    const list = row?.parentElement;
    const gap = list ? Number.parseFloat(getComputedStyle(list).rowGap) || 0 : 0;
    const pitch = row ? row.getBoundingClientRect().height + gap : 0;
    dragRef.current = {
      pointerId: e.pointerId,
      fromIndex: index,
      startY: e.clientY,
      pitch: pitch > 0 ? pitch : 1,
    };
    setDragIndex(index);
  };

  const moveDrag = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const delta = Math.round((e.clientY - drag.startY) / drag.pitch);
    const target = Math.min(reorderable.length - 1, Math.max(0, drag.fromIndex + delta));
    setDragIndex(target);
  };

  const endDrag = (e: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragIndex !== null && dragIndex !== drag.fromIndex) {
      const next = [...reorderable];
      const [moved] = next.splice(drag.fromIndex, 1);
      if (moved) next.splice(dragIndex, 0, moved);
      onReorder([...next, ...pinned]);
    }
    dragRef.current = null;
    setDragIndex(null);
  };

  return (
    <div className={className ? `lk-layer-list ${className}` : 'lk-layer-list'}>
      {reorderable.map((layer, i) => {
        const isDragging = dragIndex === i;
        return (
          <div
            key={layer.id}
            className={
              isDragging ? 'lk-layer-list__row lk-layer-list__row--dragging' : 'lk-layer-list__row'
            }
          >
            <button
              type="button"
              className="lk-layer-list__handle"
              aria-label={`Reorder ${layer.label}`}
              onPointerDown={(e) => startDrag(e, i)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
            >
              ⋮⋮
            </button>
            <input
              className="lk-layer-list__check"
              type="checkbox"
              checked={visibility[layer.id] !== false}
              onChange={(e) => onToggle(layer.id, e.target.checked)}
              aria-label={`Toggle ${layer.label}`}
            />
            <span className="lk-layer-list__label">{layer.label}</span>
          </div>
        );
      })}
      {pinned.map((layer) => (
        <div key={layer.id} className="lk-layer-list__row lk-layer-list__row--pinned">
          <span className="lk-layer-list__lock" role="img" aria-label="Always on">
            🔒
          </span>
          <span className="lk-layer-list__label">{layer.label}</span>
        </div>
      ))}
    </div>
  );
}
