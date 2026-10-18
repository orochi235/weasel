/**
 * Geometric snapping onto a scene's paths: the snapper behind the `snap`
 * dep's path targets, and the mark it leaves for the marker layer to draw.
 */
import { createEmitter } from '@weasel-js/registry';
import {
  createPathSnapIndex, findPathSnap, PATH_SNAP_KINDS,
  type Path, type PathSnapIndex, type PathSnapKind, type PathSnapTarget,
} from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { isAnnotationLayer } from 'core/scene/annotation';
import { nodeGates } from 'core/scene/nodeGates';
import type { SnapGeometry, SnapQuery } from 'interactions/actions/snapDep';
import { nodeSnapGeometry } from './snapGeometry';

type Point = { x: number; y: number };

/** `toolOptions.pathSnap`: which targets on paths a drawn or dragged point
 *  locks to. */
export interface PathSnapOptions {
  /** Kinds to turn on or off. A kind not named is on. */
  kinds?: Partial<Record<PathSnapKind, boolean>>;
  /** How near the pointer a target must be, in screen pixels. Default `8`. */
  radius?: number;
  /** Mark the snapped point with a glyph and a label for its kind. Default `true`. */
  marker?: boolean;
}

/** Where the last snap landed, and on what. */
export interface PathSnapMark {
  kind: PathSnapKind;
  x: number;
  y: number;
}

/** A scene's paths, ready to snap to. */
export interface PathSnapper {
  /** The target nearest `p` within the radius at view scale `scale`, or null
   *  when snapping is off or nothing is in range. Records the answer as the
   *  current mark. */
  snap(p: Point, at: SnapQuery | undefined, scale: { x: number; y: number }): Point | null;
  /** The mark of the last snap, until it is released or misses. */
  mark(): PathSnapMark | null;
  /** Whether the marker is to be drawn. */
  showsMarker(): boolean;
  /** Clear the mark. */
  release(): void;
  /** Replace the options; `undefined` turns snapping off. */
  configure(options: PathSnapOptions | undefined): void;
  /** Called when the mark changes. */
  subscribe(listener: () => void): () => void;
}

/** Default snap radius, in screen pixels. */
export const DEFAULT_PATH_SNAP_RADIUS = 8;

/** A snapper over every leaf of `scene` with geometry (`nodeSnapGeometry`),
 *  but hidden ones (`nodeGates`) and those on an annotation layer, indexed once per scene
 *  version, and again when a query brings geometry of its own. */
export function createPathSnapper(
  scene: Pick<Scene<unknown, string, unknown>, 'nodes' | 'layers' | 'getVersion'>,
): PathSnapper {
  const changed = createEmitter();
  let options: PathSnapOptions | undefined;
  let current: PathSnapMark | null = null;
  let cached: {
    version: number; layers: unknown; also: SnapGeometry | undefined; ids: (string | null)[]; index: PathSnapIndex;
  } | null = null;

  const indexed = (also: SnapGeometry | undefined) => {
    const version = scene.getVersion();
    const layers = scene.layers;
    if (cached?.version === version && cached.layers === layers && cached.also === also) return cached;
    const notes = new Set(layers.filter(isAnnotationLayer).map((l) => l.id));
    const gates = nodeGates({ layers, get: (id) => scene.nodes.get(id) });
    const ids: (string | null)[] = [];
    const paths: Path[] = [];
    const extra: PathSnapTarget[] = [];
    for (const node of scene.nodes.values()) {
      if (node.kind !== 'leaf' || notes.has(node.layer) || gates.hidden(node.id)) continue;
      const g = nodeSnapGeometry(node);
      if (!g) continue;
      for (const p of g.points) extra.push({ ...p, paths: [paths.length] });
      ids.push(node.id);
      paths.push(g.path);
    }
    for (const path of also?.paths ?? []) { ids.push(null); paths.push(path); }
    if (also?.anchors) {
      ids.push(null);
      for (const p of also.anchors) extra.push({ kind: 'anchor', x: p.x, y: p.y, paths: [paths.length] });
      paths.push({ kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' });
    }
    cached = { version, layers, also, ids, index: createPathSnapIndex(paths, extra) };
    return cached;
  };
  const setMark = (next: PathSnapMark | null) => {
    if (current === next || (current && next && current.kind === next.kind && current.x === next.x && current.y === next.y)) return;
    current = next;
    changed.emit();
  };

  return {
    snap(p, at, scale) {
      if (!options) return null;
      const { ids, index } = indexed(at?.also);
      const off = options.kinds ?? {};
      const exclude = at?.exclude ? new Set(at.exclude) : null;
      const include = at?.include ? new Set(at.include) : null;
      const hit = findPathSnap(index, p, {
        radius: options.radius ?? DEFAULT_PATH_SNAP_RADIUS,
        scale,
        kinds: PATH_SNAP_KINDS.filter((k) => off[k] !== false),
        ...(at?.origin ? { origin: at.origin } : {}),
        skip: (i) => {
          const id = ids[i];
          if (id === null) return false;
          return (exclude?.has(id) ?? false) || (include ? !include.has(id) : false);
        },
      });
      setMark(hit ? { kind: hit.kind, x: hit.x, y: hit.y } : null);
      return hit ? { x: hit.x, y: hit.y } : null;
    },
    mark: () => current,
    showsMarker: () => options?.marker !== false,
    release: () => setMark(null),
    configure(next) {
      options = next;
      if (!next) setMark(null);
    },
    subscribe: (listener) => changed.subscribe(listener),
  };
}
