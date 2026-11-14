import { type ReactNode, useRef, useState } from 'react';
import { type Corner, DEFAULT_ANCHOR, DEFAULT_INSET, type FloatingPlacement } from 'windease';
import { useFloatingPlacement } from '../../floating';
import s from './FloatingPanel.module.css';

/** Props for `<FloatingPanel>`. */
export interface FloatingPanelProps {
  children: ReactNode;
  /** Where it rests. Pass with `onChange` to own it; omit to let the panel hold it. */
  value?: FloatingPlacement;
  /** Called once per drag, on release, with where the drag left it. */
  onChange?: (next: FloatingPlacement) => void;
  /** Corner it rests in before it has ever been dragged, when `value` is omitted. Default `'bottom-left'`. */
  anchor?: Corner;
  /** Corners that may capture it. Default: all four. */
  snapCorners?: readonly Corner[];
  /** Pixels in from a corner when snapped. Default 12. */
  inset?: number;
  className?: string;
}

/**
 * A draggable box that floats over its offset parent and snaps to its corners.
 *
 * Placement and dragging are {@link useFloatingPlacement}'s; this adds the element and, when `value` is omitted,
 * holds the placement itself.
 */
export function FloatingPanel({
  children,
  value,
  onChange,
  anchor = DEFAULT_ANCHOR,
  snapCorners,
  inset = DEFAULT_INSET,
  className,
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState<FloatingPlacement>(() => ({ x: 0, y: 0, anchor }));
  const placement = value ?? own;
  const { style, startDrag, dragging, placed } = useFloatingPlacement({
    panelRef: ref,
    placement,
    onPlacementChange: (next) => {
      if (value === undefined) setOwn(next);
      onChange?.(next);
    },
    snapCorners,
    inset,
  });

  return (
    <div
      className={className ? `${s.panel} ${className}` : s.panel}
      data-dragging={dragging ? 'true' : undefined}
      data-placed={placed ? 'true' : undefined}
      onPointerDown={startDrag}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}
