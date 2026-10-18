import {
  createContext, useCallback, useContext, useMemo, useRef,
  type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject,
} from 'react';

type Axis = 'x' | 'y' | 'both';
type Delta = { dw: number; dh: number };

interface FrameApi {
  frame: RefObject<HTMLDivElement | null>;
  delta: RefObject<Delta>;
  apply: (next: Delta | null) => void;
}

const DemoFrameContext = createContext<FrameApi | null>(null);

/** The smallest a stage is dragged down to, per axis, in CSS pixels. */
const MIN_STAGE = 120;
const KEY_STEP = 16;

const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [KEY_STEP, 0], ArrowLeft: [-KEY_STEP, 0], ArrowDown: [0, KEY_STEP], ArrowUp: [0, -KEY_STEP],
};

/**
 * The box a demo is mounted in. It holds the one resize delta every
 * `DemoStage` inside reads, so dragging any stage's handles grows or shrinks
 * them all by the distance dragged, and a double-click puts them back at
 * their natural size.
 */
export function DemoFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const delta = useRef<Delta>({ dw: 0, dh: 0 });

  const apply = useCallback((next: Delta | null) => {
    const el = frame.current;
    if (!el) return;
    delta.current = next ?? { dw: 0, dh: 0 };
    if (next === null) {
      el.style.removeProperty('--demo-stage-dw');
      el.style.removeProperty('--demo-stage-dh');
      return;
    }
    el.style.setProperty('--demo-stage-dw', `${next.dw}px`);
    el.style.setProperty('--demo-stage-dh', `${next.dh}px`);
  }, []);
  const api = useMemo(() => ({ frame, delta, apply }), [apply]);

  return (
    <DemoFrameContext.Provider value={api}>
      <div ref={frame} className="ckd-demo-frame">{children}</div>
    </DemoFrameContext.Provider>
  );
}

/** A stage's right-edge, bottom-edge and corner handles, or nothing outside a `DemoFrame`. */
export function StageHandles() {
  const api = useContext(DemoFrameContext);
  if (!api) return null;
  return (['x', 'y', 'both'] as const).map((axis) => <ResizeHandle key={axis} axis={axis} {...api} />);
}

/** How far the stages may shrink from `start`: until the smallest reaches `MIN_STAGE` on each axis.
 *  Unbounded on an axis no stage has a laid-out size to measure on. */
function floorOf(frame: HTMLElement | null, start: Delta): Delta {
  const floor = { dw: -Infinity, dh: -Infinity };
  for (const stage of frame?.querySelectorAll('.ckd-stage') ?? []) {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0) floor.dw = Math.max(floor.dw, start.dw - (rect.width - MIN_STAGE));
    if (rect.height > 0) floor.dh = Math.max(floor.dh, start.dh - (rect.height - MIN_STAGE));
  }
  return floor;
}

function ResizeHandle({ axis, frame, delta, apply }: FrameApi & { axis: Axis }) {
  const drag = useRef<{ x: number; y: number; start: Delta; floor: Delta } | null>(null);
  const moveTo = (start: Delta, floor: Delta, dx: number, dy: number) => apply({
    dw: axis === 'y' ? start.dw : Math.max(floor.dw, start.dw + dx),
    dh: axis === 'x' ? start.dh : Math.max(floor.dh, start.dh + dy),
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = { ...delta.current };
    drag.current = { x: e.clientX, y: e.clientY, start, floor: floorOf(frame.current, start) };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) moveTo(d.start, d.floor, e.clientX - d.x, e.clientY - d.y);
  };
  const onPointerEnd = () => { drag.current = null; };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROWS[e.key];
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { ...delta.current };
    moveTo(start, floorOf(frame.current, start), step[0], step[1]);
  };

  // The corner is the one keyboard stop; the edges are wider pointer targets for the same thing.
  const a11y = axis === 'both'
    ? { role: 'button', tabIndex: 0, 'aria-label': 'Resize the demo: drag, or use the arrow keys. Double-click to reset.' }
    : { 'aria-hidden': true };
  return (
    <div
      className="ckd-demo-resize"
      data-axis={axis}
      {...a11y}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={(e) => { e.stopPropagation(); apply(null); }}
      onKeyDown={onKeyDown}
    />
  );
}
