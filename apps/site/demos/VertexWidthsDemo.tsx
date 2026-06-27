import { useMemo, useRef, useState } from 'react';
import {
  PathBuilder,
  pressureToWidth,
  usePencilTool,
  useScene,
  useTools,
  useSelection,
  SceneCanvas,
  WeaselProvider,
} from '@weasel-js/core';
import type {
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

// ───── Bottom panel: pencil tool with pressureToWidth wired in. Strokes
// commit into a `useScene` and each is rendered with its own vertexWidths
// via the `drawOne` slot.
interface PencilNode {
  path: PolygonPath;
  widths?: number[];
}

function PencilPanel() {
  const nextIdRef = useRef(1);

  const scene = useScene<PencilNode, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection();

  const pencil = usePencilTool({
    create: (path, opts) => ({
      id: `pencil-${nextIdRef.current++}`,
      kind: 'leaf' as const,
      layer: 'default' as const,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { path, widths: opts.widths } as PencilNode,
    }),
    pressureToWidth: (sample) => pressureToWidth(sample.pressure ?? 0, {
      minWidth: 1,
      maxWidth: 18,
      gamma: 1.6,
    }),
    tolerance: 1.5,
    closeThreshold: 12,
  });

  const tools = useTools({ active: 'pencil', registry: { pencil } });

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
