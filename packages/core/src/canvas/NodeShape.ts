/**
 * NodeShape — the **shape trait's** registry. Each trait of a node
 * (shape, routing, label, icon, affordances, …) is its own registry;
 * this one holds the per-kind `paint` + `silhouette` (and future
 * fields) used by `defaultDrawOne`, clipping, non-rect hit-testing,
 * lasso/area-select, and SVG export.
 *
 * Teaching the kit about a new kind of shape goes through this registry
 * rather than by overriding `drawOne`. Overrides are still possible but
 * shouldn't be the default seam: most consumers want the same dispatch
 * logic, just extended with their own shape kinds (images, custom paths,
 * SVG fragments, etc.).
 *
 * Built-in entries (`kit:text`, `kit:path`, `kit:rect-fallback`) are
 * registered at module load. Consumer entries added via
 * `registerNodeShape` join the chain; the first entry whose
 * `matches` predicate returns true paints the node.
 *
 * Two priority tiers:
 *   - `'high'` — checked before all `'normal'` entries. Use this to
 *     override a kit built-in for a specific data shape (e.g. a custom
 *     text renderer that wins over `kit:text`).
 *   - `'normal'` (default) — appended after the built-ins.
 *
 * Within a tier, entries run in registration order. Each
 * `registerNodeShape` call returns a disposer that removes the
 * entry — useful for tests, for plugin lifecycles, and for swapping
 * implementations at runtime.
 *
 * See `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`
 * for the trait taxonomy.
 */
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import { textCommand, textCommandFromRuns } from 'features/text/textCommand';
import type { TextStyle } from 'features/text/textStyle';
import type { StyledRun } from 'features/text/runs';
import type { Path } from 'features/paths/types';
import { ellipsePath, regularPolygonPath, starPath, linePath } from 'features/paths/builder';
import { poseRotationOf, rotatePathAround } from 'features/paths/poseRotation';
import { pathInPoseFrame } from 'features/paths/pathInWorld';
import { getImageBitmap, imageStatus } from 'features/images/imageCache';

/** Optional per-call paint context, threaded through `defaultDrawOne`'s third
 *  argument. Lets a rendering entry point override ambient environment reads
 *  — the headless `renderSceneToPixels` path supplies its own bitmap resolver
 *  here so consumers reuse their own decode caches. Custom painters may
 *  ignore it entirely. */
export interface NodePaintCtx {
  /** Override bitmap resolution for image nodes. When set it is authoritative:
   *  the global `imageCache` is not consulted, and an `undefined` result
   *  paints the deterministic grey placeholder outline (never the ambient
   *  load-status error variant). */
  resolveImage?: (node: Node<unknown, string, unknown>) => ImageBitmap | undefined;
}

export interface NodeShapeEntry<TData = unknown, TPose = unknown> {
  /** Stable identifier — used for unregistration and debugging. Pick
   *  something descriptive: `'kit:text'`, `'app:image'`, etc. */
  id: string;
  /** Returns true when this painter renders the node. The first matching
   *  painter (`'high'` tier first, then `'normal'`) wins. */
  matches(node: Node<TData, string, TPose>): boolean;
  /** Emits the draw commands for the node's primary visual. `ctx` is an
   *  optional per-call paint context (see `NodePaintCtx`); painters that
   *  don't need it can keep a two-argument signature. */
  paint(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodePaintCtx): DrawCommand[];
  /** Optional: derive the node's silhouette path from its pose.
   *  Used by clipping (when the container has no explicit
   *  `clipFromPose`), by non-rect hit-testing, by lasso/area-select,
   *  and by SVG export. Painters whose visual has no meaningful closed
   *  silhouette (e.g. text) leave this undefined. */
  silhouette?(node: Node<TData, string, TPose>, pose: TPose): Path | null;
}

export interface RegisterNodeShapeOptions {
  /** `'high'` puts the painter ahead of all normally-registered ones (so
   *  it can win over a kit built-in). `'normal'` appends at the end. */
  priority?: 'high' | 'normal';
}

const PAINTERS: { high: NodeShapeEntry[]; normal: NodeShapeEntry[] } = {
  high: [],
  normal: [],
};

/** Register a shape painter. Returns a disposer that removes it. */
export function registerNodeShape<TData, TPose>(
  painter: NodeShapeEntry<TData, TPose>,
  opts: RegisterNodeShapeOptions = {},
): () => void {
  const list = opts.priority === 'high' ? PAINTERS.high : PAINTERS.normal;
  list.push(painter as NodeShapeEntry);
  return () => {
    const i = list.indexOf(painter as NodeShapeEntry);
    if (i >= 0) list.splice(i, 1);
  };
}

/** Find the painter that will render `node` — first match in priority
 *  order. Returns undefined if no painter (including the built-in
 *  fallback) accepts the node. */
export function findNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
): NodeShapeEntry<TData, TPose> | undefined {
  for (const p of PAINTERS.high) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as NodeShapeEntry<TData, TPose>;
    }
  }
  for (const p of PAINTERS.normal) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as NodeShapeEntry<TData, TPose>;
    }
  }
  return undefined;
}

/** Find the painter for `node` and ask it for the node's silhouette path,
 *  in **world** coords. Returns null if no painter matches, or the matching
 *  painter has no `silhouette` method, or the method returns null. Used by
 *  clipping, generic non-rect hit-testing, lasso, and SVG export — anywhere
 *  the kit needs the "closed boundary" of whatever this kind of node draws as.
 *
 *  Painters return their silhouette in the pose's local (unrotated) frame;
 *  this bakes `pose.rotation` on top via the shared rotation convention, so
 *  clips/area-select of a rotated node use the rotated boundary the renderer
 *  draws. (`paint()` is unaffected — it applies rotation via the render wrap,
 *  not the silhouette, so there is no double-rotation.) */
export function findShapeSilhouette<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
): Path | null {
  const sil = findNodeShape(node)?.silhouette?.(node, pose) ?? null;
  if (!sil) return null;
  const r = poseRotationOf(pose);
  return r ? rotatePathAround(sil, r.cx, r.cy, r.rotation) : sil;
}

/** Snapshot of the current painters in evaluation order — `'high'` tier
 *  first, then `'normal'`. Useful for debugging which painter handles a
 *  given node. */
export function getNodeShapes(): readonly NodeShapeEntry[] {
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

const TEXT_PAINTER: NodeShapeEntry = {
  id: 'kit:text',
  matches: (node) => {
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
  paint: (node, pose) => {
    const d = node.data as { text: string; style?: TextStyle; runs?: readonly StyledRun[] };
    const p = pose as RectPose;
    const fontSize = d.style?.fontSize ?? 16;
    // Forward the pose's box height so a future `verticalAlign` opt-in has
    // something to align within. Default `verticalAlign` is 'top', which
    // resolves to a zero offset regardless of `height` — so this is a no-op
    // for every existing kit:text node. `maxWidth` (word-wrap) is
    // deliberately NOT forwarded: generic kit:text nodes have no data/style
    // slot for opting into wrap or box vertical-align yet, and forwarding
    // maxWidth would silently start wrapping consumers' existing text.
    //
    // `runs` wins over `text` when present. It is the richer form of the same
    // content — `useTextEdit` commits both, keeping `runsToPlainText(runs)`
    // equal to `text` — so re-flattening the string here would make the whole
    // run algebra write-only for anything painted by the default scene layer.
    // Empty runs are not a styling, so they fall back rather than paint
    // nothing.
    const y = p.y + fontSize;
    return d.runs && d.runs.length > 0
      ? [textCommandFromRuns(p.x, y, d.runs, d.style, undefined, p.height)]
      : [textCommand(p.x, y, d.text, d.style, undefined, p.height)];
  },
};

const PATH_PAINTER: NodeShapeEntry = {
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
    const projected = pathInPoseFrame(d.path, pose as RectPose);
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
    return pathInPoseFrame(d.path, pose as RectPose);
  },
};

/** Built-in shape dispatcher — matches when `data.shape` names a kit-known
 *  shape kind. Computes both paint and silhouette from the pose so consumer
 *  scenes can declare clipping/rendering directly in JSON without
 *  registering a custom painter. */
const SHAPE_PAINTER: NodeShapeEntry = {
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

/** Raster-image painter. Renders `data.image.src` (URL / blob: / data-URI)
 *  via an `ImageDrawCommand` once the bitmap has decoded; until then it paints
 *  a faint placeholder outline so the node stays visible + selectable (a
 *  reddish outline + slash marks a failed load). The decoded bitmap is owned
 *  by `imageCache`, keyed on `src`; the node holds only the serializable `src`.
 *  Registered before `kit:rect-fallback` so image nodes don't fall through. */
const IMAGE_PAINTER: NodeShapeEntry = {
  id: 'kit:image',
  matches: (node) => {
    const src = (node.data as { image?: { src?: unknown } } | null)?.image?.src;
    return typeof src === 'string' && src.length > 0;
  },
  paint: (node, pose, ctx) => {
    const d = node.data as { image: { src: string; opacity?: number } };
    const p = pose as RectPose;
    const bmp = ctx?.resolveImage
      ? ctx.resolveImage(node)
      : getImageBitmap(d.image.src);
    if (bmp) {
      return [{
        kind: 'image',
        image: bmp,
        x: p.x, y: p.y, w: p.width, h: p.height,
        ...(d.image.opacity !== undefined ? { opacity: d.image.opacity } : {}),
      }];
    }
    // Not ready — faint placeholder (grey while loading, reddish + slash on
    // error). With a caller-supplied resolver the fallback is deterministic:
    // always the plain grey outline, no ambient load-status read.
    const error = ctx?.resolveImage ? false : imageStatus(d.image.src) === 'error';
    const color = error ? '#d08a8a' : '#bbbbbb';
    const cmds: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      stroke: { paint: { color }, width: 1 },
    }];
    if (error) {
      cmds.push({
        kind: 'path',
        path: linePath({ x: p.x, y: p.y }, { x: p.x + p.width, y: p.y + p.height }),
        stroke: { paint: { color }, width: 1 },
      });
    }
    return cmds;
  },
  silhouette: (_node, pose) => {
    const p = pose as RectPose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
};

const RECT_FALLBACK_PAINTER: NodeShapeEntry = {
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
  registerNodeShape(TEXT_PAINTER);
  registerNodeShape(PATH_PAINTER);
  registerNodeShape(SHAPE_PAINTER);
  registerNodeShape(IMAGE_PAINTER);
  registerNodeShape(RECT_FALLBACK_PAINTER);
}

registerBuiltInShapePainters();
