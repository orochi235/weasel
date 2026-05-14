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

export interface ShapePainter<TData = unknown, TPose = unknown> {
  /** Stable identifier — used for unregistration and debugging. Pick
   *  something descriptive: `'kit:text'`, `'app:image'`, etc. */
  id: string;
  /** Returns true when this painter renders the node. The first matching
   *  painter (`'high'` tier first, then `'normal'`) wins. */
  matches(node: Node<TData, string, TPose>): boolean;
  /** Emits the draw commands for the node's primary visual. */
  paint(node: Node<TData, string, TPose>, pose: TPose): DrawCommand[];
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

const PATH_PAINTER: ShapePainter = {
  id: 'kit:path',
  matches: (node) => {
    const d = node.data as { path?: Path } | null;
    return d?.path != null;
  },
  paint: (node, _pose) => {
    const d = node.data as {
      path: Path;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      color?: string;
    };
    const cmd: DrawCommand = {
      kind: 'path',
      path: d.path,
      fill: { color: d.fill ?? d.color ?? '#888' },
      ...(d.stroke && (d.strokeWidth ?? 0) > 0
        ? { stroke: { paint: { color: d.stroke }, width: d.strokeWidth ?? 1 } }
        : {}),
    };
    return [cmd];
  },
};

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
};

function registerBuiltInShapePainters(): void {
  registerShapePainter(TEXT_PAINTER);
  registerShapePainter(PATH_PAINTER);
  registerShapePainter(RECT_FALLBACK_PAINTER);
}

registerBuiltInShapePainters();
