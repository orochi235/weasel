import { useMemo, useRef, useState } from 'react';
import {
  PathBuilder,
  SceneCanvas,
  WeaselProvider,
  asNodeId,
  boundsOfPath,
  hexToRgba,
  pathFromD,
  polygonFromPoints,
  pressureToWidth,
  rgbaToHex,
  solid,
  strokeOf,
  useActionsRegistry,
  useScene,
  useSelection,
  type DragSample,
  type FillStyle,
  type GradientFill,
  type Path,
  type Scene,
  type Stroke,
  type ToolsApi,
  type View,
} from '@weasel-js/core';
import {
  ColorField,
  InlineRange,
  PaintField,
  SceneGradientHandles,
  ToolPalette,
  type PaintSlot,
} from '@weasel-js/ui';

const W = 600, H = 420;

/** Everything the default path painter reads. `vertexColors` is one RGBA per
 *  anchor of `path`; `stroke.vertexWidths` is one width per anchor. */
interface PaintedData {
  path: Path;
  fill?: FillStyle | null;
  stroke?: Stroke | null;
  vertexColors?: number[];
}

type LayerId = 'default';

const SWATCH = asNodeId('swatch');
const PETAL = asNodeId('petal');
const RIBBON = asNodeId('ribbon');

/** `units: 'bounds'` stores the geometry as fractions of the node's own box,
 *  so the paint survives pan, zoom and resize — and is the frame
 *  `SceneGradientHandles` resolves against. */
const GRADIENT: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0.1, y: 0.1 },
  to: { x: 0.9, y: 0.9 },
  stops: [
    { offset: 0, color: '#0fb5a8' },
    { offset: 0.55, color: '#c84edb' },
    { offset: 1, color: '#f4c43c' },
  ],
  units: 'bounds',
};

const RAINBOW: [number, number, number, number][] = [
  [1.0, 0.2, 0.3, 1.0],
  [1.0, 0.6, 0.1, 1.0],
  [1.0, 0.9, 0.2, 1.0],
  [0.3, 0.9, 0.4, 1.0],
  [0.2, 0.7, 0.95, 1.0],
  [0.4, 0.4, 0.95, 1.0],
  [0.7, 0.3, 0.9, 1.0],
];

const TAPER_POINTS = [
  { x: 40, y: 380 },
  { x: 170, y: 290 },
  { x: 300, y: 380 },
  { x: 430, y: 290 },
  { x: 560, y: 380 },
];

const taperWidths = (center: number): number[] => [4, center, center, center, 4];

function heptagon(cx: number, cy: number, r: number): Path {
  return polygonFromPoints(Array.from({ length: RAINBOW.length }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / RAINBOW.length;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }));
}

function polyline(points: { x: number; y: number }[]): Path {
  return points
    .reduce((b, p, i) => (i === 0 ? b.moveTo(p.x, p.y) : b.lineTo(p.x, p.y)), new PathBuilder())
    .build();
}

/** A leaf whose pose is its path's bounds — the shape the kit's own tools
 *  produce, so the default painter draws it and `editAnchors` edits it. */
function leaf(id: ReturnType<typeof asNodeId>, path: Path, data: Omit<PaintedData, 'path'>) {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    id,
    layer: 'default' as LayerId,
    pose: { x, y, width, height },
    data: { path, ...data },
  };
}

export function StrokeAndFillDemo() {
  return (
    <WeaselProvider>
      <StrokeAndFill />
    </WeaselProvider>
  );
}

function StrokeAndFill() {
  const scene = useScene<PaintedData, LayerId>({
    systemLayers: [{ id: 'default' }],
    initial: [
      leaf(SWATCH, pathFromD('M40 40 H280 V210 H40 Z'), {
        fill: GRADIENT,
        stroke: strokeOf('#1d2733ff', 6),
      }),
      leaf(PETAL, heptagon(430, 125, 85), {
        // A placeholder fill: the renderer only enters the per-vertex shader
        // path for a command that has one, and the vertex colors win in it.
        fill: solid('#ffffffff'),
        vertexColors: RAINBOW.flat(),
      }),
      leaf(RIBBON, polyline(TAPER_POINTS), {
        stroke: {
          ...strokeOf('#7fb069ff', 4),
          vertexWidths: taperWidths(20),
          cap: 'round',
          join: 'miter',
        },
      }),
    ],
    // A paint drag fires per pointermove; without a window each frame would
    // be its own undo entry.
    coalesceWindowMs: 300,
  });
  const selection = useSelection({ initial: [SWATCH] });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const [slot, setSlot] = useState<PaintSlot>('fill');
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const selectedId = selection.get()[0] ?? null;

  // One anchor per captured sample (`polygonFromPoints`, not a curve fit) so
  // `vertexWidths[i]` lines up with anchor i exactly. Mapping the pointer
  // trail to geometry is the consumer's call, which is why the pressure curve
  // lives in an `insertNodeFactories` entry rather than on the pencil tool.
  const insertNodeFactories = useMemo(() => ({
    pencil: (_bounds: unknown, extras: unknown) => {
      const samples = (extras as { samples?: ReadonlyArray<DragSample> }).samples ?? [];
      if (samples.length < 2) return null;
      const path = polygonFromPoints(samples as { x: number; y: number }[]);
      const { x, y, width, height } = boundsOfPath(path);
      return {
        data: {
          path,
          stroke: {
            ...strokeOf('#a48bd4ff', 4),
            vertexWidths: samples.map((s) => pressureToWidth(s.pressure ?? 0, {
              minWidth: 1, maxWidth: 18, gamma: 1.6,
            })),
            cap: 'round' as const,
            join: 'round' as const,
          },
        },
        pose: { x, y, width, height },
      };
    },
  }), []);

  return (
    <div className="ckd-row">
      <div className="ckd-stack">
        {tools && <ToolPalette tools={tools} orientation="horizontal" />}
        <div className="ckd-canvas-frame" ref={hostRef}>
          <SceneCanvas
            width={W}
            height={H}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            view={view}
            onViewChange={setView}
            defaultTools={['select', 'pencil']}
            onToolsCreated={setTools}
            insertNodeFactories={insertNodeFactories}
          />
          <SceneGradientHandles
            scene={scene}
            containerRef={hostRef}
            nodeId={selectedId}
            slot={slot}
            view={view}
          />
        </div>
      </div>
      <PaintPanel scene={scene} nodeId={selectedId} onFocusSlot={setSlot} />
    </div>
  );
}

function PaintPanel({
  scene, nodeId, onFocusSlot,
}: {
  scene: Scene<PaintedData, LayerId>;
  nodeId: string | null;
  onFocusSlot: (slot: PaintSlot) => void;
}) {
  const actions = useActionsRegistry();
  const node = nodeId ? scene.get(asNodeId(nodeId)) : undefined;

  // `setFill` / `setStroke` paint the selection, so the panel commits through
  // them rather than writing `data` itself: one undo entry, and the same path
  // a color picker or a keybinding takes.
  const paint = (which: PaintSlot, next: FillStyle | null): void => {
    actions?.begin(which === 'fill' ? 'setFill' : 'setStroke', { paint: next })?.end('commit');
  };
  const write = (data: PaintedData): void => {
    if (node) scene.update(node.id, { data });
  };

  if (!node) {
    return (
      <div className="ckd-panel">
        <div className="ckd-panel-title">Paint</div>
        <p className="ckd-panel-note"><em>Click a shape to paint it.</em></p>
      </div>
    );
  }

  const data = node.data;
  const width = typeof data.stroke?.width === 'number' ? data.stroke.width : 1;
  const taper = data.stroke?.vertexWidths?.[1];

  return (
    <div className="ckd-panel">
      <div className="ckd-panel-title">Paint</div>
      <div className="ckd-paint-rows">
        {data.vertexColors
          ? (
            <div className="ckd-field">
              <span>Vertices</span>
              <div className="ckd-vertex-swatches">
                {chunk(data.vertexColors).map((rgba, i) => (
                  <ColorField
                    key={i}
                    value={rgbaToHex(rgba)}
                    aria-label={`Vertex ${i + 1}`}
                    onChange={(hex) => write({
                      ...data,
                      vertexColors: data.vertexColors!.map((v, j) =>
                        (Math.floor(j / 4) === i ? hexToRgba(hex)[j % 4] : v)),
                    })}
                  />
                ))}
              </div>
            </div>
          )
          : (
            <div className="ckd-field" onFocusCapture={() => onFocusSlot('fill')}>
              <span>Fill</span>
              <PaintField
                value={data.fill ?? null}
                aria-label="Fill"
                onChange={(next) => paint('fill', next)}
              />
            </div>
          )}

        <div className="ckd-field" onFocusCapture={() => onFocusSlot('stroke')}>
          <span>Stroke</span>
          <PaintField
            value={data.stroke?.paint ?? null}
            aria-label="Stroke"
            onChange={(next) => paint('stroke', next)}
          />
        </div>

        {data.stroke && (
          <div className="ckd-field">
            <span>Width</span>
            <InlineRange
              className="ckd-range"
              value={width}
              min={1}
              max={20}
              step={1}
              aria-label="Stroke width"
              onChange={(e) => write({
                ...data,
                stroke: { ...data.stroke!, width: Number(e.target.value) },
              })}
            />
            <output>{width.toFixed(0)}</output>
          </div>
        )}

        {taper !== undefined && (
          <div className="ckd-field">
            <span>Taper</span>
            <InlineRange
              className="ckd-range"
              value={taper}
              min={1}
              max={40}
              step={1}
              aria-label="Center width"
              onChange={(e) => write({
                ...data,
                stroke: { ...data.stroke!, vertexWidths: taperWidths(Number(e.target.value)) },
              })}
            />
            <output>{taper.toFixed(0)}</output>
          </div>
        )}
      </div>
      <p className="ckd-panel-note">
        Double-click a shape to drag its anchors. A gradient in the slot you
        last touched gets handles on the artwork.
      </p>
    </div>
  );
}

/** A flat RGBA array as one tuple per anchor. */
function chunk(flat: number[]): [number, number, number, number][] {
  return Array.from({ length: Math.floor(flat.length / 4) }, (_, i) =>
    flat.slice(i * 4, i * 4 + 4) as [number, number, number, number]);
}
