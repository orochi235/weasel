import { useMemo, useRef, useState } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';
import type { Paint, RenderLayer } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';

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
  function startDrag(
    e: React.PointerEvent,
    onMove: (x: number, y: number) => void,
  ) {
    e.preventDefault();
    const target = e.currentTarget as SVGElement;
    target.setPointerCapture(e.pointerId);
    const svg = target.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    const move = (ev: PointerEvent) =>
      onMove(ev.clientX - rect.left, ev.clientY - rect.top);
    const up = () => {
      target.removeEventListener('pointermove', move as EventListener);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      target.releasePointerCapture(e.pointerId);
    };
    target.addEventListener('pointermove', move as EventListener);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  const handleProps = {
    r: 7,
    fill: '#fff',
    stroke: '#222',
    strokeWidth: 2,
    style: { cursor: 'grab' as const, pointerEvents: 'auto' as const },
  };

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
        <circle
          {...handleProps}
          cx={from.x}
          cy={from.y}
          onPointerDown={(e) =>
            startDrag(e, (x, y) =>
              setState((s) => ({
                ...s,
                linear: { ...s.linear, from: { x, y } },
              }))
            )
          }
        />
        <circle
          {...handleProps}
          cx={to.x}
          cy={to.y}
          onPointerDown={(e) =>
            startDrag(e, (x, y) =>
              setState((s) => ({
                ...s,
                linear: { ...s.linear, to: { x, y } },
              }))
            )
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
        <circle
          {...handleProps}
          cx={center.x}
          cy={center.y}
          onPointerDown={(e) =>
            startDrag(e, (x, y) =>
              setState((s) => ({
                ...s,
                radial: { ...s.radial, center: { x, y } },
              }))
            )
          }
        />
        <circle
          {...handleProps}
          cx={edge.x}
          cy={edge.y}
          onPointerDown={(e) =>
            startDrag(e, (x, y) => {
              const dx = x - state.radial.center.x;
              const dy = y - state.radial.center.y;
              setState((s) => ({
                ...s,
                radial: {
                  ...s.radial,
                  radius: Math.max(8, Math.hypot(dx, dy)),
                },
              }));
            })
          }
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
      <circle
        {...handleProps}
        cx={center.x}
        cy={center.y}
        onPointerDown={(e) =>
          startDrag(e, (x, y) =>
            setState((s) => ({
              ...s,
              conic: { ...s.conic, center: { x, y } },
            }))
          )
        }
      />
      <circle
        {...handleProps}
        cx={tip.x}
        cy={tip.y}
        onPointerDown={(e) =>
          startDrag(e, (x, y) => {
            const dx = x - state.conic.center.x;
            const dy = y - state.conic.center.y;
            setState((s) => ({
              ...s,
              conic: { ...s.conic, angle: Math.atan2(dy, dx) },
            }));
          })
        }
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stop strip
// ---------------------------------------------------------------------------

function StopStrip({
  stops,
  setStops,
}: {
  stops: Stop[];
  setStops: (s: Stop[]) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  function bgStyle(): React.CSSProperties {
    const css = `linear-gradient(to right, ${stops
      .map((s) => `${s.color} ${s.offset * 100}%`)
      .join(', ')})`;
    return { background: css };
  }

  function onStripClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== stripRef.current) return;
    const rect = stripRef.current!.getBoundingClientRect();
    const offset = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    let lo = sorted[0],
      hi = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (offset >= sorted[i].offset && offset <= sorted[i + 1].offset) {
        lo = sorted[i];
        hi = sorted[i + 1];
        break;
      }
    }
    const t = (offset - lo.offset) / Math.max(1e-6, hi.offset - lo.offset);
    const color = lerpHex(lo.color, hi.color, t);
    setStops(
      [...sorted, { id: `s${++nextStopId}`, offset, color }].sort(
        (a, b) => a.offset - b.offset,
      ),
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        ref={stripRef}
        onClick={onStripClick}
        style={{
          width: W,
          height: 28,
          border: '1px solid #555',
          position: 'relative',
          ...bgStyle(),
        }}
      >
        {stops.map((s, i) => (
          <StopHandle
            key={s.id}
            stop={s}
            stripWidth={W}
            onMove={(offset) => {
              const next = stops.map((x, j) =>
                j === i ? { ...x, offset: clamp01(offset) } : x,
              );
              setStops(next.sort((a, b) => a.offset - b.offset));
            }}
            onRecolor={(color) => {
              const next = stops.map((x, j) => (j === i ? { ...x, color } : x));
              setStops(next);
            }}
            onDelete={() => {
              if (stops.length <= 2) return;
              setStops(stops.filter((_, j) => j !== i));
            }}
          />
        ))}
      </div>
      <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
        Click the strip to add a stop · drag to move · click swatch to recolor
        · right-click or × button to delete
      </small>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stop handle
// ---------------------------------------------------------------------------

function StopHandle({
  stop,
  stripWidth,
  onMove,
  onRecolor,
  onDelete,
}: {
  stop: Stop;
  stripWidth: number;
  onMove: (offset: number) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: stop.offset * stripWidth - 8,
        width: 16,
        height: 28,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        const stripEl = e.currentTarget.parentElement as HTMLElement;
        const rect = stripEl.getBoundingClientRect();
        const move = (ev: PointerEvent) => {
          onMove((ev.clientX - rect.left) / rect.width);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          colorRef.current?.click();
        }}
        style={{
          width: 16,
          height: 28,
          background: stop.color,
          border: '2px solid #fff',
          cursor: 'grab',
        }}
      />
      {hovered && (
        <button
          aria-label="Delete stop"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 12,
            height: 12,
            padding: 0,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            fontSize: 9,
            lineHeight: '12px',
            textAlign: 'center',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      )}
      <input
        ref={colorRef}
        type="color"
        value={normalizeHex(stop.color)}
        onChange={(e) => onRecolor(e.target.value)}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function lerpHex(a: string, b: string, t: number): string {
  const ac = hexToRgb(a),
    bc = hexToRgb(b);
  const r = Math.round(ac.r + (bc.r - ac.r) * t);
  const g = Math.round(ac.g + (bc.g - ac.g) * t);
  const bl = Math.round(ac.b + (bc.b - ac.b) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(h: string): { r: number; g: number; b: number } {
  const s = normalizeHex(h).slice(1);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function normalizeHex(h: string): string {
  if (h.length === 4)
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
