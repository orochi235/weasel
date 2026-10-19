import {
  createContext, useCallback, useContext, useMemo, useRef,
  type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject,
} from 'react';

type Axis = 'x' | 'y' | 'both';
type Delta = { dw: number; dh: number };

/**
 * What one drag resizes: a lone stage, or every stage of a `DemoStageGroup`.
 * The delta is written as `--demo-stage-dw` / `--demo-stage-dh` on `el`,
 * where the stages it covers, and anything else inside it, read it.
 */
export interface ResizeScope {
  el: RefObject<HTMLElement | null>;
  delta: RefObject<Delta>;
  apply: (next: Delta | null) => void;
}

const InFrameContext = createContext(false);
const GroupContext = createContext<ResizeScope | null>(null);

/** The smallest a stage is dragged down to, per axis, in CSS pixels. */
const MIN_STAGE = 120;
const KEY_STEP = 16;

const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [KEY_STEP, 0], ArrowLeft: [-KEY_STEP, 0], ArrowDown: [0, KEY_STEP], ArrowUp: [0, -KEY_STEP],
};

/**
 * The box a demo is mounted in. A `DemoStage` inside it gets resize handles;
 * one outside it, such as a visual baseline's, gets none. `label` names the
 * group, and with it any canvas inside that has no label of its own.
 */
export function DemoFrame({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <InFrameContext.Provider value>
      <div className="ckd-demo-frame" role={label ? 'group' : undefined} aria-label={label}>{children}</div>
    </InFrameContext.Provider>
  );
}

export function useResizeScope(el: RefObject<HTMLElement | null>): ResizeScope {
  const delta = useRef<Delta>({ dw: 0, dh: 0 });
  const apply = useCallback((next: Delta | null) => {
    const node = el.current;
    if (!node) return;
    delta.current = next ?? { dw: 0, dh: 0 };
    if (next === null) {
      node.style.removeProperty('--demo-stage-dw');
      node.style.removeProperty('--demo-stage-dh');
      return;
    }
    node.style.setProperty('--demo-stage-dw', `${next.dw}px`);
    node.style.setProperty('--demo-stage-dh', `${next.dh}px`);
  }, [el]);
  return useMemo(() => ({ el, delta, apply }), [el, apply]);
}

/** The scope a stage resizes in: its group's, or its own when it has none. */
export function useStageScope(own: RefObject<HTMLElement | null>): ResizeScope {
  const solo = useResizeScope(own);
  return useContext(GroupContext) ?? solo;
}

/**
 * Stages inside resize as one: a drag on any of them moves them all by the
 * same distance, and a double-click on any puts them all back. For panels a
 * reader compares side by side. Lays out as if it were not there.
 */
export function DemoStageGroup({ children }: { children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const scope = useResizeScope(el);
  return (
    <GroupContext.Provider value={scope}>
      <div ref={el} className="ckd-stage-group">{children}</div>
    </GroupContext.Provider>
  );
}

/** A stage's right-edge, bottom-edge and corner handles, or nothing outside a `DemoFrame`. */
export function StageHandles({ scope }: { scope: ResizeScope }) {
  if (!useContext(InFrameContext)) return null;
  return (['x', 'y', 'both'] as const).map((axis) => <ResizeHandle key={axis} axis={axis} {...scope} />);
}

function membersOf(el: HTMLElement | null): Element[] {
  if (!el) return [];
  return el.classList.contains('ckd-stage') ? [el] : [...el.querySelectorAll('.ckd-stage')];
}

/** How far the scope's stages may shrink from `start`: until the smallest reaches `MIN_STAGE` on
 *  each axis. Unbounded on an axis no stage has a laid-out size to measure on. */
function floorOf(el: HTMLElement | null, start: Delta): Delta {
  const floor = { dw: -Infinity, dh: -Infinity };
  for (const stage of membersOf(el)) {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0) floor.dw = Math.max(floor.dw, start.dw - (rect.width - MIN_STAGE));
    if (rect.height > 0) floor.dh = Math.max(floor.dh, start.dh - (rect.height - MIN_STAGE));
  }
  return floor;
}

function ResizeHandle({ axis, el, delta, apply }: ResizeScope & { axis: Axis }) {
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
    drag.current = { x: e.clientX, y: e.clientY, start, floor: floorOf(el.current, start) };
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
    moveTo(start, floorOf(el.current, start), step[0], step[1]);
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
