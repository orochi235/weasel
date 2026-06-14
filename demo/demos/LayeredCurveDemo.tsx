import { useEffect, useMemo, useState } from 'react';
import {
  LayeredCurveEditor,
  createFunctionLayer,
  type ControlPoint,
  type CurveLayer,
  type FunctionLayerState,
} from '@weasel-js/ui';

/**
 * Demo for the `LayeredCurveEditor`.
 *
 * Reconstructs the rim → contour curve from a beveled solid of
 * revolution. Two function layers share a 1D plot whose x axis spans
 * 0..halfWidth (half the object's width):
 *
 *   • bevel  (goldenrod, filled under the curve) covers x ∈ [0, b]
 *   • spline (purple, plain catmull-rom)        covers x ∈ [b, half]
 *
 * b is the bevel width — the seam between the two layers. The two
 * curves are held C0 continuous: the bevel's last anchor and the
 * spline's first anchor share their y, kept in sync inside the
 * consumer's `onLayerChange`. A third draggable handle layer lets the
 * user adjust b live; the toolbar slider sets its initial value.
 */

const HALF_WIDTH = 1.0;
const PLOT_W = 640;
const PLOT_H = 380;

// ─── partition handle (custom layer) ───────────────────────────────

interface PartitionState { x: number }

function createPartitionLayer(): CurveLayer<PartitionState> {
  return {
    id: 'partition',
    render(state, ctx) {
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      const h = ctx.plotSize.height;
      const stroke = ctx.isActive ? 'rgba(20,20,20,0.85)' : 'rgba(50,50,50,0.55)';
      return (
        <g>
          <line x1={x} x2={x} y1={0} y2={h} stroke={stroke} strokeDasharray="5 4" strokeWidth={1.5} />
          <rect
            x={x - 5} y={h / 2 - 14}
            width={10} height={28} rx={2}
            fill={stroke}
            style={{ cursor: 'ew-resize' }}
            data-anchor-index="partition"
          />
        </g>
      );
    },
    hitTest(state, plot, ctx) {
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      return Math.abs(plot.x - x) < 12 ? { kind: 'handle' } : null;
    },
    onPointerDown(_state, hit) {
      if (hit.kind !== 'handle') return;
      return {
        onMove(_state, model, _e, ctx) {
          const span = ctx.modelRange.xMax - ctx.modelRange.xMin;
          const pad = span * 0.05;
          const lo = ctx.modelRange.xMin + pad;
          const hi = ctx.modelRange.xMax - pad;
          return { x: Math.max(lo, Math.min(hi, model.x)) };
        },
      };
    },
  };
}

// ─── consumer ──────────────────────────────────────────────────────

function clampPointsToRange(
  points: readonly ControlPoint[],
  range: readonly [number, number],
): ControlPoint[] {
  const [lo, hi] = range;
  return points.map((p, i, arr) => {
    let x = p.x;
    if (i === 0) x = lo;
    else if (i === arr.length - 1) x = hi;
    else x = Math.max(lo, Math.min(hi, x));
    return { ...p, x };
  });
}

export function LayeredCurveDemo() {
  const [b, setB] = useState(0.25);

  const [bevelState, setBevelState] = useState<FunctionLayerState>(() => ({
    points: [
      { x: 0, y: 0.0 },
      { x: 0.1, y: 0.55 },
      { x: 0.25, y: 0.78 },
    ],
    activeIndex: null,
  }));
  const [splineState, setSplineState] = useState<FunctionLayerState>(() => ({
    points: [
      { x: 0.25, y: 0.78 },
      { x: 0.5, y: 0.55 },
      { x: 0.85, y: 0.35 },
      { x: 1.0, y: 0.2 },
    ],
    activeIndex: null,
  }));
  const [partitionState, setPartitionState] = useState<PartitionState>(() => ({ x: 0.25 }));

  // Re-anchor each curve's seam to b whenever b changes (toolbar
  // slider or partition-handle drag).
  useEffect(() => {
    setBevelState((prev) => ({ ...prev, points: clampPointsToRange(prev.points, [0, b]) }));
    setSplineState((prev) => ({ ...prev, points: clampPointsToRange(prev.points, [b, HALF_WIDTH]) }));
    setPartitionState((prev) => prev.x === b ? prev : { x: b });
  }, [b]);

  // Layers carry b in their config (via xClamp), so they're rebuilt
  // when b changes. Cheap; only happens on a discrete b update.
  const bevelLayer = useMemo(() => createFunctionLayer({
    id: 'bevel', domain: '1d', endpoints: 'pinned-x', constrain: 'function',
    addPointMode: 'click-curve', fill: { side: 'below' },
    xClamp: [0, b], minPoints: 2,
  }), [b]);
  const splineLayer = useMemo(() => createFunctionLayer({
    id: 'spline', domain: '1d', endpoints: 'pinned-x', constrain: 'function',
    addPointMode: 'click-curve', xClamp: [b, HALF_WIDTH], minPoints: 2,
  }), [b]);
  const partitionLayer = useMemo(() => createPartitionLayer(), []);

  const layers = useMemo(() => [
    { layer: bevelLayer, state: bevelState },
    { layer: splineLayer, state: splineState },
    { layer: partitionLayer, state: partitionState },
  ], [bevelLayer, bevelState, splineLayer, splineState, partitionLayer, partitionState]);

  const onLayerChange = (id: string, nextUnknown: unknown) => {
    if (id === 'bevel') {
      const next = nextUnknown as FunctionLayerState;
      setBevelState(next);
      // C0: the spline's first anchor's y mirrors the bevel's last.
      const seamY = next.points[next.points.length - 1].y;
      setSplineState((curr) => ({
        ...curr,
        points: curr.points.map((p, i) => (i === 0 ? { ...p, y: seamY } : p)),
      }));
    } else if (id === 'spline') {
      const next = nextUnknown as FunctionLayerState;
      setSplineState(next);
      const seamY = next.points[0].y;
      setBevelState((curr) => ({
        ...curr,
        points: curr.points.map((p, i) =>
          (i === curr.points.length - 1 ? { ...p, y: seamY } : p),
        ),
      }));
    } else if (id === 'partition') {
      const next = nextUnknown as PartitionState;
      setPartitionState(next);
      setB(next.x);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          bevel width (b):
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={b}
            onChange={(e) => setB(Number(e.currentTarget.value))}
            style={{ width: 240 }}
          />
          <code style={{ minWidth: 48, textAlign: 'right' }}>{b.toFixed(2)}</code>
        </label>
      </div>
      <LayeredCurveEditor
        layers={layers}
        onLayerChange={onLayerChange}
        width={PLOT_W}
        height={PLOT_H}
        xRange={[0, HALF_WIDTH]}
        yRange={[0, 1]}
        grid={{ divisions: 4 }}
        axes={{}}
      >
        <style>{`
          [data-layer-id="bevel"] {
            --curve-line: goldenrod;
            --curve-fill: color-mix(in srgb, goldenrod 35%, transparent);
          }
          [data-layer-id="spline"] {
            --curve-line: rebeccapurple;
          }
        `}</style>
      </LayeredCurveEditor>
    </div>
  );
}
