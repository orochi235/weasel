import { useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { useHandleDrag } from '@weasel-js/core';
import s from './handleOverlay.module.css';

/** The pieces every paint-geometry overlay draws with — `GradientHandles`
 *  and `MeshHandles` — kept here so the two drag, step and look alike. */

export interface OverlayPoint {
  x: number;
  y: number;
}

/** Which half of a gesture an edit belongs to: a live preview, or the one
 *  write that ends it. */
export type EditPhase = 'input' | 'commit';

/** The SVG overlay itself: covers its container, passes pointer input
 *  through everywhere but the handles. */
export function HandleOverlay(props: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <svg
      className={[s.overlay, props.className].filter(Boolean).join(' ')}
      width={props.width}
      height={props.height}
    >
      {props.children}
    </svg>
  );
}

export function Guide(props: { x1: number; y1: number; x2: number; y2: number }): ReactElement {
  return <line className={s.guide} {...props} />;
}

/** A cubic Bézier edge through four overlay-space points. */
export function Edge({ points }: { points: readonly [OverlayPoint, OverlayPoint, OverlayPoint, OverlayPoint] }): ReactElement {
  const [a, b, c, d] = points;
  return <path className={s.edge} d={`M${a.x} ${a.y}C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`} />;
}

/**
 * One draggable point. `onDrag` receives overlay pixels; a press that never
 * moved writes nothing, and a canceled gesture puts the preview back.
 */
export function DragPoint({
  at,
  label,
  radius,
  variant = 'handle',
  onDrag,
}: {
  at: OverlayPoint;
  label: string;
  radius: number;
  /** `control` draws the inverted style a secondary point wears. */
  variant?: 'handle' | 'control';
  onDrag: (p: OverlayPoint, phase: EditPhase) => void;
}): ReactElement {
  const start = useRef<OverlayPoint>(at);
  const drag = useHandleDrag<SVGCircleElement>({
    onStart: () => { start.current = at; },
    onMove: (p) => { onDrag(p, 'input'); },
    onEnd: ({ point, moved }) => {
      if (moved) onDrag(point, 'commit');
    },
    onCancel: () => { onDrag(start.current, 'input'); },
  });
  const onKeyDown = (e: ReactKeyboardEvent<SVGCircleElement>): void => {
    const amount = e.shiftKey ? KEY_STEP * 10 : KEY_STEP;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -amount;
    else if (e.key === 'ArrowRight') dx = amount;
    else if (e.key === 'ArrowUp') dy = -amount;
    else if (e.key === 'ArrowDown') dy = amount;
    else return;
    e.preventDefault();
    const next = { x: at.x + dx, y: at.y + dy };
    onDrag(next, 'input');
    onDrag(next, 'commit');
  };
  return (
    <circle
      className={variant === 'control' ? `${s.handle} ${s.control}` : s.handle}
      cx={at.x}
      cy={at.y}
      r={radius}
      // Not `slider`: the handle carries a 2-D position, not one value, so
      // it has no `aria-valuenow` to honor the role's contract with.
      role="button"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      {...drag}
    />
  );
}

/** One arrow-key step, in overlay pixels. */
const KEY_STEP = 1;
