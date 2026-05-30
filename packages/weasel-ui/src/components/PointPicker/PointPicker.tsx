import {
  useCallback, useMemo, useRef, useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Plot2D,
  type Plot2DHandle,
  type GridSettings,
  type AxesSettings,
} from '../Plot2D';
import { modelToPlot, type ModelRange } from '../Plot2D/geometry';
import s from './PointPicker.module.css';

export interface PointPickerProps {
  value: { x: number; y: number };
  /** Fires every frame during drag with the live in-flight position. */
  onChange: (next: { x: number; y: number }) => void;
  /** Fires once on pointerup with the committed value and the value
   *  the gesture started from. Wire history here. */
  onChangeCommit?: (next: { x: number; y: number }, prev: { x: number; y: number }) => void;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  width: number;
  height: number;
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;
  /** When true, the point renders muted and drag is refused. */
  locked?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PointPicker(props: PointPickerProps) {
  const {
    value, onChange, onChangeCommit,
    xRange = [0, 1],
    yRange = [0, 1],
    width, height,
    grid, axes,
    locked = false,
    className, style,
  } = props;

  const plotRef = useRef<Plot2DHandle | null>(null);
  const [active, setActive] = useState(false);

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );

  const plotPt = useMemo(
    () => modelToPlot(value, modelRange, { width, height }),
    [value, modelRange, width, height],
  );

  // Drag state lives in refs so window-handler closures see the latest
  // values without forcing re-renders during the drag.
  const dragRef = useRef<{
    pointerId: number;
    startValue: { x: number; y: number };
    lastNext: { x: number; y: number };
  } | null>(null);

  // Stable wrappers around per-render handlers — same pattern as
  // CurveEditor. Keeps removeEventListener / addEventListener identities
  // matched so we don't leak listeners on re-render mid-drag.
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});
  const cancelRef = useRef<(e: PointerEvent) => void>(() => {});
  const stableMove = useRef((e: PointerEvent) => moveRef.current(e)).current;
  const stableUp = useRef((e: PointerEvent) => upRef.current(e)).current;
  const stableCancel = useRef((e: PointerEvent) => cancelRef.current(e)).current;

  const cleanup = useCallback(() => {
    window.removeEventListener('pointermove', stableMove);
    window.removeEventListener('pointerup', stableUp);
    window.removeEventListener('pointercancel', stableCancel);
    dragRef.current = null;
  }, [stableMove, stableUp, stableCancel]);

  moveRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const h = plotRef.current;
    if (!h) return;
    const m = h.clientToModel({ clientX: e.clientX, clientY: e.clientY });
    // Clamp to model range — point stays inside the visible plot.
    const nx = Math.max(modelRange.xMin, Math.min(modelRange.xMax, m.x));
    const ny = Math.max(modelRange.yMin, Math.min(modelRange.yMax, m.y));
    const next = { x: nx, y: ny };
    d.lastNext = next;
    onChange(next);
  };

  upRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (onChangeCommit) onChangeCommit(d.lastNext, d.startValue);
    setActive(false);
    cleanup();
  };

  cancelRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // Restore pre-drag value; no commit.
    onChange(d.startValue);
    setActive(false);
    cleanup();
  };

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    // Locked: refuse the gesture entirely. No onChange fires.
    if (locked) return;
    setActive(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startValue: { ...value },
      lastNext: { ...value },
    };
    window.addEventListener('pointermove', stableMove);
    window.addEventListener('pointerup', stableUp);
    window.addEventListener('pointercancel', stableCancel);
  }, [locked, value, stableMove, stableUp, stableCancel]);

  const pointCls = [
    s.point,
    locked && s.locked,
    active && s.active,
  ].filter(Boolean).join(' ');

  const rootCls = [s.root, className].filter(Boolean).join(' ');

  return (
    <Plot2D
      ref={plotRef}
      className={rootCls}
      style={style}
      width={width}
      height={height}
      xRange={xRange}
      yRange={yRange}
      grid={grid}
      axes={axes}
    >
      {locked ? (
        // Locked → small diamond, mirroring CurveEditor's locked-anchor
        // visual so the two components share affordance language.
        (() => {
          const half = 3.55;
          return (
            <rect
              className={pointCls}
              x={plotPt.x - half}
              y={plotPt.y - half}
              width={half * 2}
              height={half * 2}
              transform={`rotate(45 ${plotPt.x} ${plotPt.y})`}
              data-point="locked"
            />
          );
        })()
      ) : (
        <circle
          className={pointCls}
          cx={plotPt.x}
          cy={plotPt.y}
          r={4}
          data-point="draggable"
          onPointerDown={onPointerDown}
        />
      )}
    </Plot2D>
  );
}
