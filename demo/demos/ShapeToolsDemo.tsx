// TODO(visual-regression): baseline PNG deferred — run `npm run test:visual` manually
// after the dev server is up to capture the initial snapshot.
import { useMemo } from 'react';
import {
  ellipsePath,
  linePath,
  rectPath,
  regularPolygonPath,
  SceneCanvas,
  starPath,
  useSceneAdapter,
  useEllipseTool,
  useLineTool,
  usePencilTool,
  usePolygonTool,
  useRectTool,
  useScene,
  useSelectTool,
  useSelection,
  useStarTool,
  useTools,
} from '@orochi235/weasel';
import type { AnyTool, Path, PolygonPath } from '@orochi235/weasel';
// ToolPalette is a Swillustrator-side specialization
// (apps/swillustrator/src/ui/) — see the kit/app split.
import { ToolPalette } from '../../apps/swillustrator/src/ui/ToolPalette';

interface ShapeData { path: Path; fill: string; stroke?: string; strokeWidth?: number }
type ShapeLayer = 'default';
interface ShapePose { x: number; y: number; width: number; height: number }
interface ShapeNode {
  id: string;
  kind: 'leaf';
  layer: ShapeLayer;
  pose: ShapePose;
  data: ShapeData;
  parent: null;
}

const W = 600, H = 400;

const FILLS = ['#7fb069', '#d8c8a8', '#7f8eb0', '#b07f8e', '#d4a574', '#7ab8d4'];
let _nextId = 0;
function freshId(prefix: string): string {
  _nextId += 1;
  return `${prefix}-${_nextId}`;
}
function pickFill(): string {
  return FILLS[_nextId % FILLS.length];
}
function makeNode(id: string, pose: ShapePose, data: ShapeData): ShapeNode {
  return { id, kind: 'leaf', layer: 'default', pose, data, parent: null };
}

function poseFromBounds(b: { x: number; y: number; width: number; height: number }): ShapePose {
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

export function ShapeToolsDemo() {
  const scene = useScene<ShapeData, ShapeLayer, ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useSceneAdapter(scene, { selection });

  // ── select ──────────────────────────────────────────────────────────────────
  const select = useSelectTool(adapter, {
    getSelection: () => selection.current,
  });

  // ── rect ────────────────────────────────────────────────────────────────────
  const rect = useRectTool<ShapeNode>({
    create: (b) => makeNode(freshId('rc'), poseFromBounds(b), {
      path: rectPath(b.x, b.y, b.width, b.height),
      fill: pickFill(),
    }),
  });

  // ── ellipse ─────────────────────────────────────────────────────────────────
  const ellipse = useEllipseTool<ShapeNode>({
    create: (b) => makeNode(freshId('el'), poseFromBounds(b), {
      path: ellipsePath(b),
      fill: pickFill(),
    }),
  });

  // ── line ─────────────────────────────────────────────────────────────────────
  const line = useLineTool<ShapeNode>({
    create: (a, b) => makeNode(freshId('ln'), {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x) || 1,
      height: Math.abs(b.y - a.y) || 1,
    }, {
      path: linePath(a, b),
      fill: pickFill(),
      stroke: pickFill(),
      strokeWidth: 2,
    }),
  });

  // ── polygon ──────────────────────────────────────────────────────────────────
  const polygon = usePolygonTool<ShapeNode>({
    create: (center, radius, rotation, sides) => makeNode(freshId('pg'), {
      x: center.x - radius, y: center.y - radius,
      width: radius * 2, height: radius * 2,
    }, {
      path: regularPolygonPath(center, radius, sides, rotation),
      fill: pickFill(),
    }),
  });

  // ── star ─────────────────────────────────────────────────────────────────────
  const star = useStarTool<ShapeNode>({
    create: (center, outerRadius, rotation, points) => makeNode(freshId('st'), {
      x: center.x - outerRadius, y: center.y - outerRadius,
      width: outerRadius * 2, height: outerRadius * 2,
    }, {
      path: starPath(center, outerRadius, points, undefined, rotation),
      fill: pickFill(),
    }),
  });

  // ── pencil ───────────────────────────────────────────────────────────────────
  const pencil = usePencilTool<ShapeNode>({
    create: (path: PolygonPath) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < path.coords.length; i += 2) {
        const px = path.coords[i];
        const py = path.coords[i + 1];
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      return makeNode(freshId('pe'), {
        x: isFinite(minX) ? minX : 0,
        y: isFinite(minY) ? minY : 0,
        width: isFinite(maxX - minX) ? (maxX - minX) || 1 : 1,
        height: isFinite(maxY - minY) ? (maxY - minY) || 1 : 1,
      }, {
        path,
        fill: pickFill(),
        stroke: pickFill(),
        strokeWidth: 2,
      });
    },
  });

  const registry = useMemo<Record<string, AnyTool>>(
    () => ({ select, rect, ellipse, line, polygon, star, pencil }),
    [select, rect, ellipse, line, polygon, star, pencil],
  );

  const tools = useTools({ active: 'ellipse', registry });

  return (
    <div className="ckd-shape-tools-demo">
      <ToolPalette tools={tools} orientation="horizontal" />
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
      />
    </div>
  );
}
