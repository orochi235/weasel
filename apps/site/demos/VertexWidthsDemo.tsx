import { useMemo, useState } from 'react';
import {
  PathBuilder,
  polygonFromPoints,
  pressureToWidth,
  usePencilTool,
  useScene,
  useTools,
  useSelection,
  SceneCanvas,
  WeaselProvider,
} from '@weasel-js/core';
import type {
  DragSample,
  Path,
  PolygonPath,
  Stroke,
  RenderLayer,
  DrawCommand,
} from '@weasel-js/core';

const W = 600;
const H = 240;
const SLIDER_MIN = 1;
const SLIDER_MAX = 40;

// ───── Top panel: a fixed five-anchor polyline with a slider that drags
// the center anchors' stroke width. Demonstrates the bare tessellator
// surface — the slider value flows into `Stroke.vertexWidths` and the
// miter join force-bevels once the taper ratio crosses the threshold.
function StaticTaperPanel() {
  const [centerWidth, setCenterWidth] = useState(20);

  const points = useMemo(() => [
    { x: 40, y: 160 },
    { x: 160, y: 70 },
    { x: 300, y: 160 },
    { x: 440, y: 70 },
    { x: 560, y: 160 },
  ], []);
  const path: Path = useMemo(() => {
    const b = new PathBuilder();
    b.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) b.lineTo(points[i].x, points[i].y);
    return b.build();
  }, [points]);

  const stroke: Stroke = useMemo(() => ({
    paint: { color: '#7fb069' },
    width: 4,
    vertexWidths: [4, centerWidth, centerWidth, centerWidth, 4],
    cap: 'round',
    join: 'miter',
  }), [centerWidth]);

  const layer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'static-taper',
    label: 'Static taper',
    space: 'world',
    draw: () => [{ kind: 'path', path, stroke }],
  }), [path, stroke]);

  // Empty scene — only the custom layer renders.
  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6, color: '#ddd' }}>
        <span style={{ fontFamily: 'monospace' }}>center width: {centerWidth.toFixed(0)}px</span>
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          value={centerWidth}
          onChange={(e) => setCenterWidth(Number(e.target.value))}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <span style={{ color: '#888', fontSize: 12 }}>
          drag slider · miters force-bevel above the default 1.5× taper ratio
        </span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        layers={{
          scene: { drawOne: () => [] },
          taper: { layer, after: 'scene' },
        }}
      />
    </div>
  );
}

// ───── Bottom panel: the pencil tool, with stylus pressure mapped to
// per-anchor stroke width. The tool itself is a declarative shell — the
// drag is owned by the dispatcher's `insertAction`, which hands the raw
// pointer trail (pressure and tilt included) to the `insert` dep. Mapping
// that trail to geometry is the consumer's call, so the pressure→width
// curve lives in an `insertNodeFactories` entry rather than on the tool.
interface PencilNode {
  path: PolygonPath;
  widths?: number[];
}

function PencilPanel() {
  const scene = useScene<PencilNode, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection();

  const pencil = usePencilTool();
  const tools = useTools({ active: 'pencil', registry: { pencil } });

  // One anchor per captured sample (`polygonFromPoints`, not a curve fit)
  // so `widths[i]` lines up with `path`'s anchor i exactly — which is the
  // whole point of this panel. A curve-fitting pencil would need to
  // resample the pressure track onto the fitted anchors.
  const insertNodeFactories = useMemo(() => ({
    pencil: (_bounds: unknown, extras: unknown) => {
      const samples = (extras as { samples?: ReadonlyArray<DragSample> }).samples ?? [];
      if (samples.length < 2) return null;
      const widths = samples.map((s) => pressureToWidth(s.pressure ?? 0, {
        minWidth: 1,
        maxWidth: 18,
        gamma: 1.6,
      }));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of samples) {
        if (s.x < minX) minX = s.x;
        if (s.y < minY) minY = s.y;
        if (s.x > maxX) maxX = s.x;
        if (s.y > maxY) maxY = s.y;
      }
      return {
        data: { path: polygonFromPoints(samples as { x: number; y: number }[]), widths },
        pose: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      };
    },
  }), []);

  const drawStroke = (node: { data: PencilNode }): DrawCommand[] => [{
    kind: 'path',
    path: node.data.path,
    stroke: {
      paint: { color: '#a48bd4' },
      width: 4,
      ...(node.data.widths ? { vertexWidths: node.data.widths } : {}),
      cap: 'round',
      join: 'round',
    },
  }];

  return (
    <div className="ckd-stack">
      <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>
        Drag to draw. Apple Pencil / Wacom: real pressure modulation.
        Mouse: flat 0.5-pressure stroke (per the Pointer Events spec).
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        tools={tools}
        insertNodeFactories={insertNodeFactories}
        layers={{
          scene: { drawOne: drawStroke },
        }}
      />
    </div>
  );
}

export function VertexWidthsDemo() {
  return (
    <WeaselProvider>
      <div className="ckd-stack">
        <StaticTaperPanel />
        <PencilPanel />
      </div>
    </WeaselProvider>
  );
}
