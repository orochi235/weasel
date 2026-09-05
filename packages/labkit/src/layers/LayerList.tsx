import { openPointerSession, type PointerSession } from '@weasel-js/core';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import type { LayerDescriptor } from '../instrument/types';
import { DragHandleGlyph } from '../passthrough/weasel-ui';

/** Props for `<LayerList>`. */
export interface LayerListProps {
  layers: LayerDescriptor[];
  visibility: Record<string, boolean>;
  onReorder: (newOrder: LayerDescriptor[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  className?: string;
}

interface DragState {
  fromIndex: number;
  toIndex: number;
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
  const sessionRef = useRef<PointerSession | null>(null);
  // The session's callbacks outlive the render that opened them, so the commit
  // reads its inputs here rather than from that render's closure.
  const commitRef = useRef({ reorderable, pinned, onReorder });
  commitRef.current = { reorderable, pinned, onReorder };

  useEffect(() => () => sessionRef.current?.cancel(), []);

  if (layers.length === 0) {
    return (
      <div className={className ? `lk-layer-list ${className}` : 'lk-layer-list'}>
        <div className="lk-layer-list__empty">No layers</div>
      </div>
    );
  }

  const clearDrag = () => {
    dragRef.current = null;
    sessionRef.current = null;
    setDragIndex(null);
  };

  const startDrag = (e: ReactPointerEvent<HTMLElement>, index: number) => {
    // Measured at grab time rather than hardcoded: a restyle that changes row
    // height or gap would otherwise silently skew every drag distance.
    const row = e.currentTarget.closest('.lk-layer-list__row');
    const list = row?.parentElement;
    const gap = list ? Number.parseFloat(getComputedStyle(list).rowGap) || 0 : 0;
    const pitch = row ? row.getBoundingClientRect().height + gap : 0;
    const drag: DragState = {
      fromIndex: index,
      toIndex: index,
      startY: e.clientY,
      pitch: pitch > 0 ? pitch : 1,
    };
    dragRef.current = drag;
    setDragIndex(index);
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        const delta = Math.round((ev.clientY - drag.startY) / drag.pitch);
        const last = commitRef.current.reorderable.length - 1;
        drag.toIndex = Math.min(last, Math.max(0, drag.fromIndex + delta));
        setDragIndex(drag.toIndex);
      },
      onEnd: () => {
        const { reorderable: rows, pinned: locked, onReorder: commit } = commitRef.current;
        const { fromIndex, toIndex } = drag;
        clearDrag();
        if (toIndex === fromIndex) return;
        const next = [...rows];
        const [moved] = next.splice(fromIndex, 1);
        if (moved) next.splice(toIndex, 0, moved);
        commit([...next, ...locked]);
      },
      // An interrupted drag never named a destination, so it reorders nothing.
      onCancel: clearDrag,
    });
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
            >
              <DragHandleGlyph size={13} />
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
