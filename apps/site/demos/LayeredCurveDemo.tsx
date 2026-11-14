import { useMemo, useState } from 'react';
import {
  CustomLayer, FunctionLayer, LayeredCurveEditor, type ControlPoint, type CurveLayer, type FunctionLayerState,
} from '@weasel-js/ui/components/CurveEditor';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';

/**
 * The rim → contour curve of a beveled solid of revolution, as two function
 * layers on one plot: the bevel covers x ∈ [0, b] and the spline x ∈ [b, half].
 * The curves are held C0 continuous at the seam b — the bevel's last anchor and
 * the spline's first share their y, kept in sync in each layer's `onChange`. A third
 * layer is the draggable handle for b.
 */

const HALF_WIDTH = 1.0;
const PLOT_W = 640;
const PLOT_H = 380;
const BEVEL_FILL = { side: 'below' } as const;

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

/** `points` stretched from the span their ends cover onto `range`, so a seam
 *  moved and moved back leaves them where they were. */
function stretchPointsToRange(
  points: readonly ControlPoint[],
  range: readonly [number, number],
): ControlPoint[] {
  const [lo, hi] = range;
  const from = points[0]?.x ?? lo;
  const span = (points.at(-1)?.x ?? hi) - from;
  return points.map((p, i, arr) => {
    const x = i === 0 ? lo : i === arr.length - 1 ? hi : span > 0 ? lo + ((p.x - from) / span) * (hi - lo) : lo;
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

  // Moving the seam re-anchors both curves to it.
  const moveSeam = (next: number) => {
    setB(next);
    setBevelState((prev) => ({ ...prev, points: stretchPointsToRange(prev.points, [0, next]) }));
    setSplineState((prev) => ({ ...prev, points: stretchPointsToRange(prev.points, [next, HALF_WIDTH]) }));
    setPartitionState((prev) => prev.x === next ? prev : { x: next });
  };

  // The curves' x bounds follow b.
  const bevelClamp = useMemo(() => [0, b] as const, [b]);
  const splineClamp = useMemo(() => [b, HALF_WIDTH] as const, [b]);
  const partitionLayer = useMemo(() => createPartitionLayer(), []);

  const onBevelChange = (next: FunctionLayerState) => {
    setBevelState(next);
    // C0: the spline's first anchor's y mirrors the bevel's last.
    const seamY = next.points[next.points.length - 1].y;
    setSplineState((curr) => ({
      ...curr,
      points: curr.points.map((p, i) => (i === 0 ? { ...p, y: seamY } : p)),
    }));
  };
  const onSplineChange = (next: FunctionLayerState) => {
    setSplineState(next);
    const seamY = next.points[0].y;
    setBevelState((curr) => ({
      ...curr,
      points: curr.points.map((p, i) =>
        (i === curr.points.length - 1 ? { ...p, y: seamY } : p),
      ),
    }));
  };
  const onPartitionChange = (next: PartitionState) => {
    setPartitionState(next);
    moveSeam(next.x);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          bevel width (b):
          <InlineRange
            min={0.05}
            max={0.95}
            step={0.01}
            value={b}
            onChange={(e) => moveSeam(Number(e.currentTarget.value))}
            style={{ width: 240 }}
          />
          <code style={{ minWidth: 48, textAlign: 'right' }}>{b.toFixed(2)}</code>
        </label>
      </div>
      <LayeredCurveEditor
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
        <FunctionLayer
          id="bevel" domain="1d" endpoints="pinned-x" constrain="function" addPointMode="click-curve"
          fill={BEVEL_FILL} xClamp={bevelClamp} minPoints={2} state={bevelState} onChange={onBevelChange}
        />
        <FunctionLayer
          id="spline" domain="1d" endpoints="pinned-x" constrain="function" addPointMode="click-curve"
          xClamp={splineClamp} minPoints={2} state={splineState} onChange={onSplineChange}
        />
        <CustomLayer layer={partitionLayer} state={partitionState} onChange={onPartitionChange} />
      </LayeredCurveEditor>
    </div>
  );
}
