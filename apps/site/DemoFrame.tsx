import {
  createContext, useCallback, useRef, useState,
  type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject,
} from 'react';

/** Registers a stage with the frame around it; returns the unregister. */
export const DemoFrameContext = createContext<(() => () => void) | null>(null);

type Axis = 'x' | 'y' | 'both';
type Delta = { dw: number; dh: number };

/** The smallest a stage is dragged down to, per axis, in CSS pixels. */
const MIN_STAGE = 120;
const KEY_STEP = 16;

const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [KEY_STEP, 0], ArrowLeft: [-KEY_STEP, 0], ArrowDown: [0, KEY_STEP], ArrowUp: [0, -KEY_STEP],
};

/**
 * The box a demo is mounted in. Once a `DemoStage` mounts inside, it grows
 * handles on its right edge, bottom edge and corner; dragging one grows or
 * shrinks every stage in the demo by the distance dragged, and a
 * double-click puts them back at their natural size.
 */
export function DemoFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const delta = useRef<Delta>({ dw: 0, dh: 0 });
  const [stages, setStages] = useState(0);
  const register = useCallback(() => {
    setStages((n) => n + 1);
    return () => setStages((n) => n - 1);
  }, []);

  const apply = useCallback((next: Delta | null) => {
    const el = ref.current;
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

  return (
    <DemoFrameContext.Provider value={register}>
      <div ref={ref} className={stages > 0 ? 'ckd-demo-frame ckd-demo-frame--resizable' : 'ckd-demo-frame'}>
        {children}
        {stages > 0 && (['x', 'y', 'both'] as const).map((axis) => (
          <ResizeHandle key={axis} axis={axis} frame={ref} delta={delta} apply={apply} />
        ))}
      </div>
    </DemoFrameContext.Provider>
  );
}

interface HandleProps {
  axis: Axis;
  frame: RefObject<HTMLDivElement | null>;
  delta: RefObject<Delta>;
  apply: (next: Delta | null) => void;
}

/** How far a stage may shrink from `start`: down to `MIN_STAGE` on each axis.
 *  Unbounded when the stage has no laid-out size to measure. */
function floorOf(frame: HTMLElement | null, start: Delta): Delta {
  const rect = frame?.querySelector('.ckd-stage')?.getBoundingClientRect();
  return {
    dw: rect && rect.width > 0 ? start.dw - (rect.width - MIN_STAGE) : -Infinity,
    dh: rect && rect.height > 0 ? start.dh - (rect.height - MIN_STAGE) : -Infinity,
  };
}

function ResizeHandle({ axis, frame, delta, apply }: HandleProps) {
  const drag = useRef<{ x: number; y: number; start: Delta; floor: Delta } | null>(null);
  const moveTo = (start: Delta, floor: Delta, dx: number, dy: number) => apply({
    dw: axis === 'y' ? start.dw : Math.max(floor.dw, start.dw + dx),
    dh: axis === 'x' ? start.dh : Math.max(floor.dh, start.dh + dy),
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
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
      onDoubleClick={() => apply(null)}
      onKeyDown={onKeyDown}
    />
  );
}
