import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LayeredCurveEditor,
  createFunctionLayer,
  functionLayerState,
  type ControlPoint,
  type CurveLayer,
  type FunctionLayerState,
} from './';

// ─────────────────────────────────────────────────────────────────────
// Story 1 — function + numerical derivative (read-only derived layer)
// ─────────────────────────────────────────────────────────────────────

function numericalDerivative(points: readonly ControlPoint[]): ControlPoint[] {
  if (points.length < 2) return [];
  const out: ControlPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const left = points[Math.max(0, i - 1)];
    const right = points[Math.min(points.length - 1, i + 1)];
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const slope = dx === 0 ? 0 : dy / dx;
    const y = 0.5 + Math.max(-2, Math.min(2, slope)) / 4;
    out.push({ x: points[i].x, y });
  }
  return out;
}

function TwoLayersDemo() {
  const fnLayer = useMemo(
    () => createFunctionLayer({
      id: 'fn',
      domain: '1d',
      endpoints: 'pinned-x',
      constrain: 'function',
    }),
    [],
  );
  const derivativeLayer = useMemo(
    () => createFunctionLayer({ id: 'derivative', domain: '1d', interactive: false }),
    [],
  );

  const [fnState, setFnState] = useState<FunctionLayerState>(
    () => functionLayerState([
      { x: 0, y: 0.1 },
      { x: 0.25, y: 0.3 },
      { x: 0.55, y: 0.85 },
      { x: 0.8, y: 0.4 },
      { x: 1, y: 0.9 },
    ]),
  );
  const [derivState, setDerivState] = useState<FunctionLayerState>(
    () => functionLayerState(numericalDerivative(fnState.points)),
  );

  const layers = useMemo(
    () => [
      { layer: derivativeLayer, state: derivState },
      { layer: fnLayer, state: fnState },
    ],
    [derivativeLayer, derivState, fnLayer, fnState],
  );

  const onLayerChange = (id: string, next: unknown) => {
    if (id === 'fn') {
      const fn = next as FunctionLayerState;
      setFnState(fn);
      setDerivState((prev) => ({ ...prev, points: numericalDerivative(fn.points) }));
    } else if (id === 'derivative') {
      setDerivState(next as FunctionLayerState);
    }
  };

  return (
    <LayeredCurveEditor
      layers={layers}
      onLayerChange={onLayerChange}
      width={500}
      height={300}
      grid={{ divisions: 3 }}
      axes={{}}
    >
      <style>{`
        [data-layer-id="derivative"] { --curve-line: var(--wzl-fg-subtle, #888); }
      `}</style>
    </LayeredCurveEditor>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Story 2 — beveled rim → contour curve
// ─────────────────────────────────────────────────────────────────────
//
// Two function layers sharing a 1D domain split at x=b (the bevel
// width). The bevel layer (goldenrod, filled below) covers x ∈ [0, b];
// the contour spline (purple) covers [b, halfWidth]. The seam at x=b
// is held C0 — the two layers' seam anchors share y, kept in sync by
// the consumer inside `onLayerChange`. A third draggable handle layer
// lets the user adjust b live; a Storybook slider provides the initial
// value.

const HALF_WIDTH = 1.0;

interface PartitionState {
  x: number;
}

function createPartitionLayer(): CurveLayer<PartitionState> {
  return {
    id: 'partition',
    render(state, ctx) {
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      const h = ctx.plotSize.height;
      const activeStroke = ctx.isActive ? 'rgba(80,80,80,0.8)' : 'rgba(80,80,80,0.45)';
      return (
        <g>
          <line
            x1={x} x2={x}
            y1={0} y2={h}
            stroke={activeStroke}
            strokeDasharray="5 4"
            strokeWidth={1.5}
          />
          <rect
            x={x - 5}
            y={h / 2 - 14}
            width={10}
            height={28}
            rx={2}
            fill={activeStroke}
            style={{ cursor: 'ew-resize' }}
            data-anchor-index="partition"
          />
        </g>
      );
    },
    hitTest(state, plot, ctx) {
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      return Math.abs(plot.x - x) < 10 ? { kind: 'handle' } : null;
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

interface RimContourArgs {
  initialB: number;
  width: number;
}

function clampPointsToRange(
  points: readonly ControlPoint[],
  range: readonly [number, number],
  pinFirstAtLeft: boolean,
  pinLastAtRight: boolean,
): ControlPoint[] {
  const [lo, hi] = range;
  return points.map((p, i, arr) => {
    let x = p.x;
    if (pinFirstAtLeft && i === 0) x = lo;
    else if (pinLastAtRight && i === arr.length - 1) x = hi;
    else x = Math.max(lo, Math.min(hi, x));
    return { ...p, x };
  });
}

function RimContourDemo(args: RimContourArgs) {
  const [b, setB] = useState(args.initialB);
  useEffect(() => { setB(args.initialB); }, [args.initialB]);

  // Initial anchor sets — interior anchors capture the visual shape;
  // endpoints will be pinned in place by the layers.
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
      { x: 0.25, y: 0.78 },  // seam — y must match bevel's last
      { x: 0.5, y: 0.55 },
      { x: 0.85, y: 0.35 },
      { x: 1.0, y: 0.2 },
    ],
    activeIndex: null,
  }));
  const [partitionState, setPartitionState] = useState<PartitionState>(() => ({ x: 0.25 }));

  // Re-anchor the seam to b whenever b changes (slider or handle drag).
  useEffect(() => {
    setBevelState((prev) => ({
      ...prev,
      points: clampPointsToRange(prev.points, [0, b], true, true),
    }));
    setSplineState((prev) => ({
      ...prev,
      points: clampPointsToRange(prev.points, [b, HALF_WIDTH], true, true),
    }));
    setPartitionState((prev) => prev.x === b ? prev : { x: b });
  }, [b]);

  // Layers are recreated on b changes so xClamp tracks the partition.
  const bevelLayer = useMemo(() => createFunctionLayer({
    id: 'bevel',
    domain: '1d',
    endpoints: 'pinned-x',
    constrain: 'function',
    addPointMode: 'click-curve',
    fill: { side: 'below' },
    xClamp: [0, b],
    minPoints: 2,
  }), [b]);
  const splineLayer = useMemo(() => createFunctionLayer({
    id: 'spline',
    domain: '1d',
    endpoints: 'pinned-x',
    constrain: 'function',
    addPointMode: 'click-curve',
    xClamp: [b, HALF_WIDTH],
    minPoints: 2,
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
      // C0: spline's first anchor's y follows bevel's last anchor's y.
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
    <LayeredCurveEditor
      layers={layers}
      onLayerChange={onLayerChange}
      width={args.width}
      height={Math.round(args.width * 0.6)}
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
  );
}

// ─────────────────────────────────────────────────────────────────────
// Storybook plumbing
// ─────────────────────────────────────────────────────────────────────

function StoryRoot({ children }: { children: ReactNode }) {
  return <div style={{ padding: 16 }}>{children}</div>;
}

const meta: Meta = {
  title: 'weasel-ui/LayeredCurveEditor',
};
export default meta;

export const FunctionPlusDerivative: StoryObj = {
  render: () => <StoryRoot><TwoLayersDemo /></StoryRoot>,
};

export const RimContour: StoryObj<RimContourArgs> = {
  render: (args) => <StoryRoot><RimContourDemo {...args} /></StoryRoot>,
  args: {
    initialB: 0.25,
    width: 600,
  },
  argTypes: {
    initialB: {
      control: { type: 'range', min: 0.05, max: 0.95, step: 0.01 },
      description: 'Initial bevel width (model units, range 0..1). The on-plot handle adjusts it live afterward.',
    },
    width: {
      control: { type: 'range', min: 300, max: 900, step: 20 },
    },
  },
};

