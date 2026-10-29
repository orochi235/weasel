import { createContext, useContext, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { useHandleDrag } from '@weasel-js/core';
import { arrowMove } from '@weasel-js/headless';
import s from './handleOverlay.module.css';

/** The pieces every paint-geometry overlay draws with — `GradientHandles`
 *  and `MeshHandles` — kept here so the two drag, step and look alike. */

/** A point in the overlay's own pixels. */
export interface OverlayPoint {
  x: number;
  y: number;
}

/** Which half of a gesture an edit belongs to: a live preview, or the one
 *  write that ends it. */
export type EditPhase = 'input' | 'commit';

/** What an overlay's points call when a drag on one of them is canceled. */
const CancelContext = createContext<(() => void) | undefined>(undefined);

/** The SVG overlay itself: covers its container, passes pointer input
 *  through everywhere but the handles. */
export function HandleOverlay(props: {
  width: number;
  height: number;
  className?: string;
  /** A drag on one of the overlay's points was canceled, after its preview was put back. */
  onCancel?: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <svg
      className={[s.overlay, props.className].filter(Boolean).join(' ')}
      width={props.width}
      height={props.height}
    >
      <CancelContext.Provider value={props.onCancel}>{props.children}</CancelContext.Provider>
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
 * One draggable point. `onDrag` receives overlay pixels: where the point
 * goes, which trails the pointer by wherever on the handle it was grabbed. A
 * press that never moved writes nothing, and a canceled gesture puts the
 * preview back, then tells the overlay's `onCancel`.
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
  const onCancel = useContext(CancelContext);
  const start = useRef<OverlayPoint>(at);
  // Where on the handle the press landed, so the point keeps that offset from the pointer.
  const grab = useRef<OverlayPoint>({ x: 0, y: 0 });
  const held = (p: OverlayPoint): OverlayPoint => ({ x: p.x - grab.current.x, y: p.y - grab.current.y });
  const drag = useHandleDrag<SVGCircleElement>({
    onStart: (p) => {
      start.current = at;
      grab.current = { x: p.x - at.x, y: p.y - at.y };
    },
    onMove: (p) => { onDrag(held(p), 'input'); },
    onEnd: ({ point, moved }) => {
      if (moved) onDrag(held(point), 'commit');
    },
    onCancel: () => {
      onDrag(start.current, 'input');
      onCancel?.();
    },
  });
  const onKeyDown = (e: ReactKeyboardEvent<SVGCircleElement>): void => {
    const move = arrowMove(e.key, e.shiftKey);
    if (move === null) return;
    e.preventDefault();
    const next = { x: at.x + move.dx * KEY_STEP, y: at.y + move.dy * KEY_STEP };
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
