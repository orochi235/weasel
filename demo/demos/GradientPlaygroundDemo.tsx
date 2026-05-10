import { useMemo, useRef, useState } from 'react';
import { SceneCanvas, hexToRgba, rgbaToHex, useHandleDrag, useScene } from '@orochi235/weasel';
import type { Paint, RenderLayer } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';
import { RangePicker, paintGradientTrack, type Thumb } from '@orochi235/weasel-ui';

const W = 600;
const H = 400;

type Variant = 'linear-gradient' | 'radial-gradient' | 'conic-gradient';

interface Stop {
  id: string;
  offset: number;
  color: string;
}

interface VariantState {
  linear: { from: { x: number; y: number }; to: { x: number; y: number } };
  radial: { center: { x: number; y: number }; radius: number };
  conic: { center: { x: number; y: number }; angle: number };
  stops: Stop[];
}

const DEFAULT_STOPS: Stop[] = [
  { id: 's0', offset: 0, color: '#0fb5a8' },
  { id: 's1', offset: 0.55, color: '#c84edb' },
  { id: 's2', offset: 1, color: '#f4c43c' },
];

let nextStopId = DEFAULT_STOPS.length;

const SHAPE_RECT = { x: 80, y: 60, width: W - 160, height: H - 120 };

export function GradientPlaygroundDemo() {
  const [variant, setVariant] = useState<Variant>('linear-gradient');
  const [state, setState] = useState<VariantState>({
    linear: { from: { x: 100, y: 80 }, to: { x: W - 100, y: H - 80 } },
    radial: { center: { x: W / 2, y: H / 2 }, radius: 160 },
    conic: { center: { x: W / 2, y: H / 2 }, angle: 0 },
    stops: DEFAULT_STOPS,
  });

  const paint: Paint = useMemo(() => {
    if (variant === 'linear-gradient') {
      return {
        fill: 'linear-gradient',
        from: state.linear.from,
        to: state.linear.to,
        stops: state.stops,
      };
    }
    if (variant === 'radial-gradient') {
      return {
        fill: 'radial-gradient',
        center: state.radial.center,
        radius: state.radial.radius,
        stops: state.stops,
      };
    }
    return {
      fill: 'conic-gradient',
      center: state.conic.center,
      angle: state.conic.angle,
      stops: state.stops,
    };
  }, [variant, state]);

  // Render the rect through a custom RenderLayer (not via the scene) so the
  // built-in select tool has nothing to grab — only the SVG handles are
  // interactive. paintRef lets the layer's draw() see the current paint
  // without recreating the layer object every render.
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'gradient-rect',
    label: 'Gradient rect',
    draw: (_data, view): DrawCommand[] => [{
      kind: 'group',
      transform: viewToMat3(view),
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: SHAPE_RECT.x, y: SHAPE_RECT.y, width: SHAPE_RECT.width, height: SHAPE_RECT.height },
        fill: paintRef.current,
      }],
    }],
  }), []);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <Tabs value={variant} onChange={setVariant} />
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            gradient: { layer, after: 'scene' },
          }}
        />
        <HandleOverlay
          variant={variant}
          state={state}
          setState={setState}
          width={W}
          height={H}
        />
      </div>
      <StopStrip
        stops={state.stops}
        setStops={(stops) => setState((s) => ({ ...s, stops }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function Tabs({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  const opts: { id: Variant; label: string }[] = [
    { id: 'linear-gradient', label: 'Linear' },
    { id: 'radial-gradient', label: 'Radial' },
    { id: 'conic-gradient', label: 'Conic' },
  ];
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {opts.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: '6px 12px',
            background: value === o.id ? '#3a3a3a' : 'transparent',
            color: '#ddd',
            border: '1px solid #555',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Handle overlay
// ---------------------------------------------------------------------------

function HandleOverlay({
  variant,
  state,
  setState,
  width,
  height,
}: {
  variant: Variant;
  state: VariantState;
  setState: (s: VariantState | ((prev: VariantState) => VariantState)) => void;
  width: number;
  height: number;
}) {
  if (variant === 'linear-gradient') {
    const { from, to } = state.linear;
    return (
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeDasharray="4 4"
        />
        <DragCircle
          cx={from.x}
          cy={from.y}
          onMove={(x, y) =>
            setState((s) => ({ ...s, linear: { ...s.linear, from: { x, y } } }))
          }
        />
        <DragCircle
          cx={to.x}
          cy={to.y}
          onMove={(x, y) =>
            setState((s) => ({ ...s, linear: { ...s.linear, to: { x, y } } }))
          }
        />
      </svg>
    );
  }

  if (variant === 'radial-gradient') {
    const { center, radius } = state.radial;
    const edge = { x: center.x + radius, y: center.y };
    return (
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.4}
          strokeDasharray="4 4"
        />
        <DragCircle
          cx={center.x}
          cy={center.y}
          onMove={(x, y) =>
            setState((s) => ({ ...s, radial: { ...s.radial, center: { x, y } } }))
          }
        />
        <DragCircle
          cx={edge.x}
          cy={edge.y}
          onMove={(x, y) => {
            const dx = x - state.radial.center.x;
            const dy = y - state.radial.center.y;
            setState((s) => ({
              ...s,
              radial: { ...s.radial, radius: Math.max(8, Math.hypot(dx, dy)) },
            }));
          }}
        />
      </svg>
    );
  }

  // conic
  const { center, angle } = state.conic;
  const tip = {
    x: center.x + Math.cos(angle) * 80,
    y: center.y + Math.sin(angle) * 80,
  };
  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <line
        x1={center.x}
        y1={center.y}
        x2={tip.x}
        y2={tip.y}
        stroke="#fff"
        strokeOpacity={0.6}
        strokeDasharray="4 4"
      />
      <DragCircle
        cx={center.x}
        cy={center.y}
        onMove={(x, y) =>
          setState((s) => ({ ...s, conic: { ...s.conic, center: { x, y } } }))
        }
      />
      <DragCircle
        cx={tip.x}
        cy={tip.y}
        onMove={(x, y) => {
          const dx = x - state.conic.center.x;
          const dy = y - state.conic.center.y;
          setState((s) => ({ ...s, conic: { ...s.conic, angle: Math.atan2(dy, dx) } }));
        }}
      />
    </svg>
  );
}

function DragCircle({ cx, cy, onMove }: { cx: number; cy: number; onMove: (x: number, y: number) => void }) {
  const drag = useHandleDrag<SVGCircleElement>({ onMove: ({ x, y }) => onMove(x, y) });
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill="#fff"
      stroke="#222"
      strokeWidth={2}
      style={{ cursor: 'grab', pointerEvents: 'auto' }}
      {...drag}
    />
  );
}

// ---------------------------------------------------------------------------
// Stop strip (RangePicker-based)
// ---------------------------------------------------------------------------

type StopThumb = Thumb & { key: string; color: string };

function StopStrip({
  stops,
  setStops,
}: {
  stops: Stop[];
  setStops: (s: Stop[]) => void;
}) {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);

  const thumbs: StopThumb[] = sorted.map(s => ({
    value: s.offset,
    key: s.id,
    color: s.color,
  }));

  function gradientAtT(t: number): string {
    if (sorted.length === 0) return '#000';
    if (sorted.length === 1) return sorted[0].color;
    if (t <= sorted[0].offset) return sorted[0].color;
    if (t >= sorted[sorted.length - 1].offset) return sorted[sorted.length - 1].color;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (t >= sorted[i].offset && t <= sorted[i + 1].offset) {
        const frac = (t - sorted[i].offset) / Math.max(1e-6, sorted[i + 1].offset - sorted[i].offset);
        return lerpHex(sorted[i].color, sorted[i + 1].color, frac);
      }
    }
    return sorted[sorted.length - 1].color;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <RangePicker<StopThumb>
        min={0} max={1} step={0.005}
        constraint="free"
        thumbs={thumbs}
        onChange={ts => {
          setStops(ts.map(t => ({ id: t.key, offset: t.value, color: t.color })));
        }}
        onAddThumb={atValue => {
          const color = gradientAtT(atValue);
          return { value: atValue, key: `s${++nextStopId}`, color };
        }}
        onRemoveThumb={() => sorted.length > 2}
        renderTrack={paintGradientTrack({ gradient: gradientAtT })}
        readoutPlacement="none"
      />
      <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
        Click the track to add a stop · drag to move · drag off to remove (min 2)
      </small>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgba(a);
  const [br, bg, bb] = hexToRgba(b);
  return rgbaToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t, 1]);
}

