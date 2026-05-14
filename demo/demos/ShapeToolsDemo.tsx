// TODO(visual-regression): baseline PNG deferred — run `npm run test:visual` manually
// after the dev server is up to capture the initial snapshot.
import { useMemo } from 'react';
import {
  SceneCanvas,
  sceneToAdapter,
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
import type { AnyTool, PolygonPath } from '@orochi235/weasel';
// ToolPalette is a Swillustrator-side specialization
// (apps/swillustrator/src/ui/) — see the kit/app split.
import { ToolPalette } from '../../apps/swillustrator/src/ui/ToolPalette';
import type { DrawCommand } from '../../src/renderer';

interface ShapeData { fill: string }
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
function makeNode(id: string, pose: ShapePose, fill: string): ShapeNode {
  return { id, kind: 'leaf', layer: 'default', pose, data: { fill }, parent: null };
}

export function ShapeToolsDemo() {
  const scene = useScene<ShapeData, ShapeLayer, ShapePose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

  // ── select ──────────────────────────────────────────────────────────────────
  const select = useSelectTool(adapter, {
    getSelection: () => selection.current,
  });

  // ── rect ────────────────────────────────────────────────────────────────────
  const rect = useRectTool<ShapeNode>({
    create: (bounds) => makeNode(freshId('rc'), bounds, pickFill()),
  });

  // ── ellipse ─────────────────────────────────────────────────────────────────
  const ellipse = useEllipseTool<ShapeNode>({
    create: (bounds) => makeNode(freshId('el'), bounds, pickFill()),
  });

  // ── line ─────────────────────────────────────────────────────────────────────
  const line = useLineTool<ShapeNode>({
    create: (a, b) => {
      const pose: ShapePose = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x) || 1,
        height: Math.abs(b.y - a.y) || 1,
      };
      return makeNode(freshId('ln'), pose, pickFill());
    },
  });

  // ── polygon ──────────────────────────────────────────────────────────────────
  const polygon = usePolygonTool<ShapeNode>({
    create: (center, radius) => {
      const pose: ShapePose = {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
      return makeNode(freshId('pg'), pose, pickFill());
    },
  });

  // ── star ─────────────────────────────────────────────────────────────────────
  const star = useStarTool<ShapeNode>({
    create: (center, outerRadius) => {
      const pose: ShapePose = {
        x: center.x - outerRadius,
        y: center.y - outerRadius,
        width: outerRadius * 2,
        height: outerRadius * 2,
      };
      return makeNode(freshId('st'), pose, pickFill());
    },
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
      const pose: ShapePose = {
        x: isFinite(minX) ? minX : 0,
        y: isFinite(minY) ? minY : 0,
        width: isFinite(maxX - minX) ? (maxX - minX) || 1 : 1,
        height: isFinite(maxY - minY) ? (maxY - minY) || 1 : 1,
      };
      return makeNode(freshId('pe'), pose, pickFill());
    },
  });

  const registry = useMemo<Record<string, AnyTool>>(
    () => ({ select, rect, ellipse, line, polygon, star, pencil }),
    [select, rect, ellipse, line, polygon, star, pencil],
  );

  const tools = useTools({ active: 'ellipse', registry });

  return (
    <div className="ckd-shape-tools-demo">
      <ToolPalette tools={tools} />
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
        layers={{
          scene: {
            drawOne: (node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: node.data.fill },
            }],
          },
        }}
      />
    </div>
  );
}
