import { createContext, useContext, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { useHandleDrag } from '@weasel-js/routing/react';
import { arrowMove } from '@weasel-js/quantity';
import { useLatest } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import { useEditDraft, type EditCallbacks } from '../../useEditDraft';
import { ARROW_KEYSHORTCUTS } from '../../handles';
import { useControlHold, type ControlHold } from '../Disabled/controlHold';
import type { HoldProps } from '../Disabled';
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

/** What an overlay's points report about an edit's bounds: one starting, and one canceled. */
export interface EditSession {
  begin: () => void;
  /** `sent` says whether the edit sent anything to `onInput`, which then hears the value it began from. */
  cancel: (sent: boolean) => void;
}

const NO_SESSION: EditSession = { begin: () => {}, cancel: () => {} };
const SessionContext = createContext<EditSession>(NO_SESSION);
/** The overlay's hold, which every point it draws answers to. */
const HoldContext = createContext<ControlHold | null>(null);

/**
 * The edit protocol an overlay runs over its whole value: the draft a commit-only caller sees, a commit that
 * changed nothing dropped, and a canceled drag sent back to the value it began from rather than one rebuilt
 * from the handle's pixels.
 */
export function useOverlayEdit<V>(value: V, cb: EditCallbacks<V>): {
  shown: V;
  emit: (next: V, phase: EditPhase) => void;
  session: EditSession;
} {
  const { shown, onInput, onChange, onCancel } = useEditDraft(value, cb);
  const valueRef = useLatest(value);
  const from = useRef<{ value: V } | null>(null);
  const emit = (next: V, phase: EditPhase): void => {
    if (phase === 'input') {
      onInput(next);
      return;
    }
    const base = from.current ? from.current.value : valueRef.current;
    from.current = null;
    if (!deepEqual(next, base)) onChange(next);
  };
  const session: EditSession = {
    begin: () => { from.current = { value: valueRef.current }; },
    cancel: (sent) => {
      const start = from.current;
      from.current = null;
      if (sent && start) onInput(start.value);
      onCancel();
    },
  };
  return { shown, emit, session };
}

/** The SVG overlay itself: covers its container, passes pointer input
 *  through everywhere but the handles. Held disabled or read-only, by `hold` or a scope, its points move nothing. */
export function HandleOverlay(props: {
  width: number;
  height: number;
  className?: string;
  /** From {@link useOverlayEdit}: where the overlay's points report a drag starting and one canceled. */
  session: EditSession;
  hold?: HoldProps;
  children: ReactNode;
}): ReactElement {
  const hold = useControlHold(props.hold ?? {});
  return hold.wrap(
    <svg
      className={[s.overlay, props.className].filter(Boolean).join(' ')}
      width={props.width}
      height={props.height}
      data-held={hold.held}
    >
      <HoldContext.Provider value={hold}>
        <SessionContext.Provider value={props.session}>{props.children}</SessionContext.Provider>
      </HoldContext.Provider>
    </svg>,
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
 * press that never moved writes nothing, and a canceled gesture (Escape, a lost pointer) is reported to the
 * overlay's session. An arrow key moves the point one step, or with `axis` one step along it: Up and Right
 * toward `axis`, Down and Left away.
 */
export function DragPoint({
  at,
  label,
  radius,
  variant = 'handle',
  axis,
  onDrag: onPointDrag,
}: {
  at: OverlayPoint;
  label: string;
  radius: number;
  /** `control` draws the inverted style a secondary point wears. */
  variant?: 'handle' | 'control';
  /** A unit direction in overlay pixels: the point carries one value, which the arrow keys step along it. */
  axis?: OverlayPoint;
  onDrag: (p: OverlayPoint, phase: EditPhase) => void;
}): ReactElement {
  const hold = useContext(HoldContext);
  const live = useContext(SessionContext);
  // A held point sends no edit, so it has no edit to begin or cancel either.
  const session = hold?.refuses ? NO_SESSION : live;
  const onDrag = hold ? hold.gate(onPointDrag) : onPointDrag;
  const sent = useRef(false);
  const dragging = useRef(false);
  // Where on the handle the press landed, so the point keeps that offset from the pointer.
  const grab = useRef<OverlayPoint>({ x: 0, y: 0 });
  const held = (p: OverlayPoint): OverlayPoint => ({ x: p.x - grab.current.x, y: p.y - grab.current.y });
  const drag = useHandleDrag<SVGCircleElement>({
    onStart: (p) => {
      session.begin();
      sent.current = false;
      dragging.current = true;
      grab.current = { x: p.x - at.x, y: p.y - at.y };
    },
    onMove: (p) => {
      sent.current = true;
      onDrag(held(p), 'input');
    },
    onEnd: ({ point, moved }) => {
      dragging.current = false;
      if (moved) onDrag(held(point), 'commit');
    },
    onCancel: () => {
      dragging.current = false;
      session.cancel(sent.current);
    },
    escape: true,
  });
  const onKeyDown = (e: ReactKeyboardEvent<SVGCircleElement>): void => {
    const move = arrowMove(e.key, e.shiftKey);
    if (move === null) return;
    e.preventDefault();
    // A step mid-drag would commit, and take the drag's start with it, under the pointer's own edit.
    if (dragging.current) return;
    const along = (move.dx - move.dy) * KEY_STEP;
    const next = axis
      ? { x: at.x + axis.x * along, y: at.y + axis.y * along }
      : { x: at.x + move.dx * KEY_STEP, y: at.y + move.dy * KEY_STEP };
    session.begin();
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
      aria-keyshortcuts={ARROW_KEYSHORTCUTS}
      tabIndex={hold ? hold.tabIndex(0) : 0}
      {...hold?.focus}
      onKeyDown={onKeyDown}
      {...drag}
    />
  );
}

/** One arrow-key step, in overlay pixels. */
const KEY_STEP = 1;
