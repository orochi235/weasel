import type { Meta, StoryObj } from '@weasel-js/forge';
import { useMemo, useState, type ReactNode } from 'react';
import { isPrimaryPress } from '@weasel-js/gestures';
import {
  CustomLayer, FunctionLayer, KeyframeLayer, LayeredCurveEditor, functionLayerState, keyframeLayerState,
  type ControlPoint, type CurveLayer, type FunctionLayerState, type KeyframeLayerState,
} from '@weasel-js/ui/components/CurveEditor';
import s from './LayeredCurveEditor.stories.module.css';

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

  const onFnChange = (fn: FunctionLayerState) => {
    setFnState(fn);
    setDerivState((prev) => ({ ...prev, points: numericalDerivative(fn.points) }));
  };

  return (
    <LayeredCurveEditor width={500} height={300} grid={{ divisions: 3 }} axes={{}}>
      <FunctionLayer id="derivative" domain="1d" interactive={false} state={derivState} onInput={setDerivState} />
      <FunctionLayer id="fn" domain="1d" endpoints="pinned-x" constrain="function" state={fnState} onInput={onFnChange} />
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
// the consumer inside each layer's `onInput`. A third draggable handle layer
// lets the user adjust b live; a control slider provides the initial
// value.

const HALF_WIDTH = 1.0;
const BEVEL_FILL = { side: 'below' } as const;

interface PartitionState {
  x: number;
}

/** The seam's grip, held between `lo` and `hi`. */
function createPartitionLayer(lo: number, hi: number): CurveLayer<PartitionState> {
  return {
    id: 'partition',
    render(state, ctx) {
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      const h = ctx.plotSize.height;
      const activeStroke = ctx.active ? 'rgba(80,80,80,0.8)' : 'rgba(80,80,80,0.45)';
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
            className={s.partition}
            data-anchor-index="partition"
          />
        </g>
      );
    },
    hitTest(state, plot, ctx) {
      // Only the drawn grip: the seam's own line carries both curves' end anchors, which must stay draggable.
      const x = ctx.toPlot({ x: state.x, y: 0 }).x;
      const onGrip = Math.abs(plot.x - x) < 10 && Math.abs(plot.y - ctx.plotSize.height / 2) <= 14 + 4;
      return onGrip ? { kind: 'handle' } : null;
    },
    onPointerDown(_state, hit, e) {
      if (hit.kind !== 'handle' || !isPrimaryPress(e)) return;
      return {
        onMove(_state, model) {
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

const BEVEL: readonly ControlPoint[] = [{ x: 0, y: 0.0 }, { x: 0.1, y: 0.55 }, { x: 0.25, y: 0.78 }];
// The spline's first anchor is the seam, whose y must match the bevel's last.
const SPLINE: readonly ControlPoint[] = [{ x: 0.25, y: 0.78 }, { x: 0.5, y: 0.55 }, { x: 0.85, y: 0.35 }, { x: 1.0, y: 0.2 }];

/**
 * Where the seam may sit: inside the plot's margin, and a sliver past each curve's nearest interior anchor, so moving
 * it never stacks an anchor on the seam's.
 */
function seamBounds(bevel: readonly ControlPoint[], spline: readonly ControlPoint[]): readonly [number, number] {
  const sliver = HALF_WIDTH / 100;
  return [
    Math.max(HALF_WIDTH * 0.05, bevel[bevel.length - 2].x + sliver),
    Math.min(HALF_WIDTH * 0.95, spline[1].x - sliver),
  ];
}

function clampSeam(x: number, [lo, hi]: readonly [number, number]): number {
  return Math.max(lo, Math.min(hi, x));
}

/** `points` with the first anchor at `lo` and the last at `hi`. */
function withEnds(points: readonly ControlPoint[], lo: number, hi: number): ControlPoint[] {
  return points.map((p, i) => (i === 0 ? { ...p, x: lo } : i === points.length - 1 ? { ...p, x: hi } : p));
}

function RimContourDemo(args: RimContourArgs) {
  const [b, setB] = useState(() => clampSeam(args.initialB, seamBounds(BEVEL, SPLINE)));
  const [bevelState, setBevelState] = useState<FunctionLayerState>(() => functionLayerState(withEnds(BEVEL, 0, b)));
  const [splineState, setSplineState] = useState<FunctionLayerState>(() => functionLayerState(withEnds(SPLINE, b, HALF_WIDTH)));
  const [partitionState, setPartitionState] = useState<PartitionState>(() => ({ x: b }));
  const [seamLo, seamHi] = seamBounds(bevelState.points, splineState.points);

  // Moving the seam (handle drag or the initialB control) moves both curves' ends with it; the bounds keep it clear of
  // their interior anchors, so a cancel that moves it back leaves both curves as they were.
  const moveSeam = (to: number) => {
    const next = clampSeam(to, [seamLo, seamHi]);
    setB(next);
    setBevelState((prev) => ({ ...prev, points: withEnds(prev.points, 0, next) }));
    setSplineState((prev) => ({ ...prev, points: withEnds(prev.points, next, HALF_WIDTH) }));
    setPartitionState((prev) => prev.x === next ? prev : { x: next });
  };
  const [initialB, setInitialB] = useState(args.initialB);
  if (args.initialB !== initialB) {
    setInitialB(args.initialB);
    moveSeam(args.initialB);
  }

  const bevelClamp = useMemo(() => [0, b] as const, [b]);
  const splineClamp = useMemo(() => [b, HALF_WIDTH] as const, [b]);
  const partitionLayer = useMemo(() => createPartitionLayer(seamLo, seamHi), [seamLo, seamHi]);

  const onBevelChange = (next: FunctionLayerState) => {
    setBevelState(next);
    // C0: spline's first anchor's y follows bevel's last anchor's y.
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
    <LayeredCurveEditor
      width={args.width}
      height={Math.round(args.width * 0.6)}
      xRange={[0, HALF_WIDTH]}
      yRange={[0, 1]}
      grid={{ divisions: 4 }}
      axes={{}}
    >
      <FunctionLayer
        id="bevel" domain="1d" endpoints="pinned-x" constrain="function" addPointMode="click-curve"
        fill={BEVEL_FILL} xClamp={bevelClamp} minPoints={2} state={bevelState} onInput={onBevelChange}
      />
      <FunctionLayer
        id="spline" domain="1d" endpoints="pinned-x" constrain="function" addPointMode="click-curve"
        xClamp={splineClamp} minPoints={2} state={splineState} onInput={onSplineChange}
      />
      <CustomLayer layer={partitionLayer} state={partitionState} onInput={onPartitionChange} />
    </LayeredCurveEditor>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Story plumbing
// ─────────────────────────────────────────────────────────────────────

function StoryRoot({ children }: { children: ReactNode }) {
  return <div className={s.root}>{children}</div>;
}

const meta: Meta = {
  title: 'ui/CurveEditor/LayeredCurveEditor',
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

// ─────────────────────────────────────────────────────────────────────
// Story 3 — keyframes: value over time, eased per segment
// ─────────────────────────────────────────────────────────────────────

const OPACITY_TIME = [0, 1000] as const;
const OPACITY_RANGE = [0, 100] as const;

function KeyframesDemo() {
  const [state, setState] = useState<KeyframeLayerState>(() => ({
    ...keyframeLayerState([
      { t: 0, value: 10 },
      { t: 350, value: 90, easing: { bezier: [0.2, 0.9, 0.3, 1] } },
      { t: 700, value: 40, easing: 'easeInOutCubic' },
      { t: 1000, value: 70 },
    ]),
    selectedSegment: 1,
  }));
  return (
    <LayeredCurveEditor
      aria-label="Opacity over time"
      width={480}
      height={220}
      xRange={[0, 1000]}
      yRange={[0, 100]}
      grid={{ divisions: 3 }}
    >
      <KeyframeLayer label="Opacity" xClamp={OPACITY_TIME} yClamp={OPACITY_RANGE} state={state} onInput={setState} />
    </LayeredCurveEditor>
  );
}

export const Keyframes: StoryObj = { render: () => <StoryRoot><KeyframesDemo /></StoryRoot> };
