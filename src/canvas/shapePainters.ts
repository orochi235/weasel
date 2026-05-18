/**
 * Shape-painter registry — pluggable dispatch for `defaultDrawOne`.
 *
 * Teaching the kit about a new kind of shape goes through this registry
 * rather than by overriding `drawOne`. Overrides are still possible but
 * shouldn't be the default seam: most consumers want the same dispatch
 * logic, just extended with their own shape kinds (images, custom paths,
 * SVG fragments, etc.).
 *
 * Built-in painters (`kit:text`, `kit:path`, `kit:rect-fallback`) are
 * registered at module load. Consumer painters added via
 * `registerShapePainter` join the chain; the first painter whose
 * `matches` predicate returns true paints the node.
 *
 * Two priority tiers:
 *   - `'high'` — checked before all `'normal'` painters. Use this to
 *     override a kit built-in for a specific data shape (e.g. a custom
 *     text renderer that wins over `kit:text`).
 *   - `'normal'` (default) — appended after the built-ins.
 *
 * Within a tier, painters run in registration order. Each
 * `registerShapePainter` call returns a disposer that removes the
 * painter — useful for tests, for plugin lifecycles, and for swapping
 * implementations at runtime.
 */
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import { textCommand } from 'features/text/textCommand';
import type { TextStyle } from 'features/text/textStyle';
import type { Path } from 'features/paths/types';
import { ellipsePath, regularPolygonPath, starPath } from 'features/paths/builder';
import { boundsOfPath } from 'features/paths/bounds';
import { translatePath } from 'features/paths/transform';

export interface ShapePainter<TData = unknown, TPose = unknown> {
  /** Stable identifier — used for unregistration and debugging. Pick
   *  something descriptive: `'kit:text'`, `'app:image'`, etc. */
  id: string;
  /** Returns true when this painter renders the node. The first matching
   *  painter (`'high'` tier first, then `'normal'`) wins. */
  matches(node: Node<TData, string, TPose>): boolean;
  /** Emits the draw commands for the node's primary visual. */
  paint(node: Node<TData, string, TPose>, pose: TPose): DrawCommand[];
  /** Optional: derive the node's silhouette path from its pose.
   *  Used by clipping (when the container has no explicit
   *  `clipFromPose`), by non-rect hit-testing, by lasso/area-select,
   *  and by SVG export. Painters whose visual has no meaningful closed
   *  silhouette (e.g. text) leave this undefined. */
  silhouette?(node: Node<TData, string, TPose>, pose: TPose): Path | null;
}

export interface RegisterShapePainterOptions {
  /** `'high'` puts the painter ahead of all normally-registered ones (so
   *  it can win over a kit built-in). `'normal'` appends at the end. */
  priority?: 'high' | 'normal';
}

const PAINTERS: { high: ShapePainter[]; normal: ShapePainter[] } = {
  high: [],
  normal: [],
};

/** Register a shape painter. Returns a disposer that removes it. */
export function registerShapePainter<TData, TPose>(
  painter: ShapePainter<TData, TPose>,
  opts: RegisterShapePainterOptions = {},
): () => void {
  const list = opts.priority === 'high' ? PAINTERS.high : PAINTERS.normal;
  list.push(painter as ShapePainter);
  return () => {
    const i = list.indexOf(painter as ShapePainter);
    if (i >= 0) list.splice(i, 1);
  };
}

/** Find the painter that will render `node` — first match in priority
 *  order. Returns undefined if no painter (including the built-in
 *  fallback) accepts the node. */
export function findShapePainter<TData, TPose>(
  node: Node<TData, string, TPose>,
): ShapePainter<TData, TPose> | undefined {
  for (const p of PAINTERS.high) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as ShapePainter<TData, TPose>;
    }
  }
  for (const p of PAINTERS.normal) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as ShapePainter<TData, TPose>;
    }
  }
  return undefined;
}

/** Find the painter for `node` and ask it for the node's silhouette path.
 *  Returns null if no painter matches, or the matching painter has no
 *  `silhouette` method, or the method returns null. Used by clipping,
 *  generic non-rect hit-testing, lasso, and SVG export — anywhere the
 *  kit needs the "closed boundary" of whatever this kind of node draws as. */
export function findShapeSilhouette<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
): Path | null {
  const painter = findShapePainter(node);
  return painter?.silhouette?.(node, pose) ?? null;
}

/** Snapshot of the current painters in evaluation order — `'high'` tier
 *  first, then `'normal'`. Useful for debugging which painter handles a
 *  given node. */
export function getShapePainters(): readonly ShapePainter[] {
  return [...PAINTERS.high, ...PAINTERS.normal];
}

/** Test-only: clear the registry and re-register the built-ins. */
export function _resetShapePaintersForTests(): void {
  PAINTERS.high.length = 0;
  PAINTERS.normal.length = 0;
  registerBuiltInShapePainters();
}

// ─── Built-in painters ─────────────────────────────────────────────────

interface RectPose { x: number; y: number; width: number; height: number }

const TEXT_PAINTER: ShapePainter = {
  id: 'kit:text',
  matches: (node) => {
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
  paint: (node, pose) => {
    const d = node.data as { text: string; style?: TextStyle };
    const p = pose as RectPose;
    const fontSize = d.style?.fontSize ?? 16;
    return [textCommand(p.x, p.y + fontSize, d.text, d.style)];
  },
};

/**
 * Translate a path so its AABB origin lands on `pose.x, pose.y`. The bundled
 * shape tools (`useBuiltinShapeTools`) initialise paths in absolute world
 * coordinates matching the initial pose, so painters that ignored pose
 * rendered at the original location after a move/resize. By aligning the
 * path's bounds to the live pose origin every paint, both committed pose
 * mutations AND in-flight preview poses (Phase 14e preview-ghost layer)
 * render at the right place without needing the actions to mutate `data.path`.
 *
 * Returns the path unchanged when the delta is zero so the fast-path
 * (no allocation, no Float32Array copy for polygons) stays hot.
 */
function pathAtPose(path: Path, pose: RectPose): Path {
  if (path.kind === 'rect') {
    // Rebase the rect onto the pose. Resize updates `pose.width/height` (not
    // the path), so we honor those too — otherwise a corner drag would
    // translate the path's old size onto the new origin instead of growing
    // the rendered fill to match the new pose.
    if (
      path.x === pose.x && path.y === pose.y
      && path.width === pose.width && path.height === pose.height
    ) return path;
    return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  }
  // Polygon paths: translate by the AABB-origin delta. Resize on a polygon
  // path needs a per-vertex scale; that's `pathPoseDescriptor.remapBounds`,
  // which the resize action ALREADY applies to the pose's bounds via the
  // configured `PoseProjection`. Here we just align the path to the pose
  // origin — the rendered polygon then matches the new bounds.
  const b = boundsOfPath(path);
  const dx = pose.x - b.x;
  const dy = pose.y - b.y;
  if (dx === 0 && dy === 0) return path;
  return translatePath(path, dx, dy);
}

const PATH_PAINTER: ShapePainter = {
  id: 'kit:path',
  matches: (node) => {
    const d = node.data as { path?: Path } | null;
    return d?.path != null;
  },
  paint: (node, pose) => {
    const d = node.data as {
      path: Path;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      color?: string;
    };
    const projected = pathAtPose(d.path, pose as RectPose);
    const hasStroke = !!d.stroke && d.stroke !== 'none' && (d.strokeWidth ?? 0) > 0;
    const fillColor = d.fill ?? d.color;
    // Treat 'none' as "skip fill". When neither fill nor color is set, fall
    // back to a default fill only if there's no stroke — otherwise the path
    // is stroke-only (e.g. pencil) and a default fill would be wrong.
    const hasFill = fillColor !== 'none' && (fillColor !== undefined || !hasStroke);
    const cmd: DrawCommand = {
      kind: 'path',
      path: projected,
      ...(hasFill ? { fill: { color: fillColor ?? '#888' } } : {}),
      ...(hasStroke
        ? { stroke: { paint: { color: d.stroke! }, width: d.strokeWidth ?? 1 } }
        : {}),
    };
    return [cmd];
  },
  silhouette: (node, pose) => {
    const d = node.data as { path: Path };
    return pathAtPose(d.path, pose as RectPose);
  },
};

/** Built-in shape dispatcher — matches when `data.shape` names a kit-known
 *  shape kind. Computes both paint and silhouette from the pose so consumer
 *  scenes can declare clipping/rendering directly in JSON without
 *  registering a custom painter. */
const SHAPE_PAINTER: ShapePainter = {
  id: 'kit:shape',
  matches: (node) => {
    const s = (node.data as { shape?: string } | null)?.shape;
    return s != null && SHAPE_KINDS.has(s);
  },
  paint: (node, pose) => {
    const d = node.data as { shape: string; color?: string; fill?: string; stroke?: string; strokeWidth?: number; sides?: number; points?: number };
    const path = pathForShape(d, pose as RectPose);
    return [{
      kind: 'path',
      path,
      fill: { color: d.fill ?? d.color ?? '#888' },
      ...(d.stroke && (d.strokeWidth ?? 0) > 0
        ? { stroke: { paint: { color: d.stroke }, width: d.strokeWidth ?? 1 } }
        : {}),
    }];
  },
  silhouette: (node, pose) => {
    const d = node.data as { shape: string; sides?: number; points?: number };
    return pathForShape(d, pose as RectPose);
  },
};

const SHAPE_KINDS = new Set(['rect', 'ellipse', 'polygon', 'star']);

function pathForShape(
  d: { shape: string; sides?: number; points?: number },
  p: RectPose,
): Path {
  switch (d.shape) {
    case 'ellipse':
      return ellipsePath(p);
    case 'polygon': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return regularPolygonPath({ x: cx, y: cy }, r, d.sides ?? 6);
    }
    case 'star': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return starPath({ x: cx, y: cy }, r, d.points ?? 5);
    }
    case 'rect':
    default:
      return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  }
}

const RECT_FALLBACK_PAINTER: ShapePainter = {
  // Last-resort painter — always matches, so it must be registered last
  // within `'normal'`. Consumers who want a different fallback should
  // register their own painter at `'high'` priority and let this one
  // never fire (or unregister it explicitly).
  id: 'kit:rect-fallback',
  matches: () => true,
  paint: (node, pose) => {
    const d = node.data as { color?: string } | null;
    const p = pose as RectPose;
    return [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { color: d?.color ?? '#888' },
    }];
  },
  silhouette: (_node, pose) => {
    const p = pose as RectPose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
};

function registerBuiltInShapePainters(): void {
  registerShapePainter(TEXT_PAINTER);
  registerShapePainter(PATH_PAINTER);
  registerShapePainter(SHAPE_PAINTER);
  registerShapePainter(RECT_FALLBACK_PAINTER);
}

registerBuiltInShapePainters();
