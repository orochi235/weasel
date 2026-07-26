/**
 * Kit-native SVG export for the WeaselDraw scene.
 *
 * Walks the scene's container tree (`scene.roots` + `scene.childrenOf`) via
 * `sceneToSvgNodes`: every `kind:'container'` node becomes an `SvgGroupNode`
 * (recursing) stamped with `meta.wd.attrs['group-id']` = its scene id, so the
 * structure round-trips back through `svgNodesToSceneDrafts` on import. Every
 * leaf is lowered to an `Obj` (pose baked into its `path`) and handed to
 * `objToSvgNode`.
 *
 * Pose rotation rides on `SvgPathNode.rotation` / `SvgTextNode.rotation`
 * so the serializer emits a `transform="rotate(... cx cy)"`. The path
 * itself is in unrotated, pose-aligned coordinates — same convention
 * used by the kit's path painter.
 *
 * Background fill is emitted as a leading `<path>` covering the viewBox.
 * Omitted when the color is white-equivalent so the SVG isn't bloated
 * with a redundant first node.
 */
import {
  type Scene,
  type Path,
  pathInPoseFrame,
  rectPath,
  unionBounds,
} from '@weasel-js/core';
import {
  serializeSvg,
  type SvgNode,
} from '@weasel-js/svg';

import {
  docToSerializeOptions,
  sceneToSvgNodes,
  SWILL_NAMESPACES,
  type SceneSource,
  type WeaselDrawPaperSize,
} from './svgInterop';
import type { Obj, PathObj, TextObj } from './poseUpdate';

interface WeaselDrawPose {
  x: number; y: number; width: number; height: number; rotation?: number;
}

interface WeaselDrawData {
  path?: Path;
  text?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

const WHITE = /^#?fff(fff)?(ff)?$/i;

/**
 * Lower a leaf node's `{data, pose}` to an `Obj` for `objToSvgNode`. The
 * pose is baked into the geometry (rect → fresh rect from pose dims;
 * polygon → translated so its AABB origin lands at pose.x/y), and rotation
 * rides on the `Obj` so the serializer emits a rotate transform. Returns
 * `null` for a leaf with no drawable data.
 */
function leafToObj(id: string, data: WeaselDrawData, pose: WeaselDrawPose): Obj | null {
  if (data.text != null) {
    const o: TextObj = {
      id,
      tool: 'text',
      x: pose.x, y: pose.y, width: pose.width, height: pose.height,
      text: data.text,
    };
    if (pose.rotation) o.rotation = pose.rotation;
    return o;
  }
  if (data.path == null) return null;
  const path = pathInPoseFrame(data.path, pose);
  const o: PathObj = {
    id,
    tool: 'imported',
    x: pose.x, y: pose.y, width: pose.width, height: pose.height,
    path,
    // `objToSvgNode` emits a solid fill iff `closed`, else fill:none. The
    // WeaselDraw leaf model has no `closed` flag — fill presence is the
    // signal — so derive `closed` from `data.fill` to preserve the prior
    // export's "fill when data.fill is set, else none" behavior.
    closed: data.fill != null,
    fill: data.fill ?? '#000000',
    stroke: data.stroke ?? '#000000',
    strokeWidth: data.stroke && (data.strokeWidth ?? 0) > 0 ? (data.strokeWidth ?? 1) : 0,
  };
  if (pose.rotation) o.rotation = pose.rotation;
  return o;
}

export interface SceneToSvgOptions {
  /** Document filename — used as the `<title>` element. */
  filename: string;
  /** Paper size key. Round-trips via `wd:paperSize`. */
  paperSize: WeaselDrawPaperSize;
  /** Paper dimensions in CSS px (the document's viewBox + width/height). */
  paperWidth: number;
  paperHeight: number;
  /** Background fill. Emitted as a leading `<path>` filling the viewBox.
   *  Omitted when the color is white (`#ffffff` / `#fff`). */
  backgroundColor: string;
}

/**
 * Build the `SceneSource` `sceneToSvgNodes` walks: `objOf` lowers a leaf's
 * stored `{data, pose}` to an `Obj` (pose baked into the path);
 * `sceneToSvgNodes` stamps each container's scene id onto `wd:group-id` so
 * groups round-trip. Shared by {@link sceneToSvgString} (whole scene) and
 * {@link selectionToSvgString} (selection subset, via the `roots` param).
 */
function sceneSourceOf<TLayer extends string>(
  scene: Scene<WeaselDrawData, TLayer, WeaselDrawPose>,
): SceneSource {
  return {
    roots: scene.roots.map(String),
    childrenOf: (id) => scene.childrenOf(id as never).map(String),
    kindOf: (id) => (scene.get(id as never)?.kind === 'container' ? 'container' : 'leaf'),
    objOf: (id) => {
      const node = scene.get(id as never);
      if (!node || node.kind !== 'leaf') return undefined;
      return leafToObj(id, node.data, node.pose) ?? undefined;
    },
  };
}

/**
 * Serialize a WeaselDraw scene to an SVG document string. Caller is
 * responsible for triggering the download (see `downloadSvg` in
 * `./svgInterop`).
 */
export function sceneToSvgString<TLayer extends string>(
  scene: Scene<WeaselDrawData, TLayer, WeaselDrawPose>,
  opts: SceneToSvgOptions,
): string {
  const nodes: SvgNode[] = [];

  // Background — prepend so it paints first (SVG paint order is document
  // order). Omit when white-equivalent to keep the file small.
  if (!WHITE.test(opts.backgroundColor)) {
    nodes.push({
      kind: 'path',
      path: rectPath(0, 0, opts.paperWidth, opts.paperHeight),
      fill: { kind: 'solid', color: opts.backgroundColor },
    });
  }

  nodes.push(...sceneToSvgNodes(sceneSourceOf(scene)));

  return serializeSvg(nodes, docToSerializeOptions({
    title: opts.filename,
    size: { width: opts.paperWidth, height: opts.paperHeight },
    paperSize: opts.paperSize,
  }));
}

/**
 * Recover the true selected roots from a `ClipboardSnapshot.items` list
 * (adapter-shaped node copies from `sceneAdapter.snapshotSelection`).
 *
 * A copied container's snapshot flattens its full subtree alongside it
 * (parents-before-children) — not just the ids the user selected. Feeding
 * every item's id to {@link selectionToSvgString} as a walk root would
 * double-emit descendants: once nested under the exported `<g>`, once
 * again as spurious top-level siblings. This mirrors the same `isRoot`
 * predicate `sceneAdapter.commitPaste` uses on the paste side: an item is
 * a root when its captured `parent` is null or wasn't itself captured in
 * this snapshot.
 */
export function clipboardSnapshotRootIds(
  items: readonly { id: string; parent: string | null }[],
): string[] {
  const itemIds = new Set(items.map((n) => n.id));
  return items
    .filter((n) => n.parent == null || !itemIds.has(n.parent))
    .map((n) => n.id);
}

/**
 * Serialize a subset of a WeaselDraw scene — exactly the given root ids
 * (and, for selected containers, their descendants) — to an SVG document
 * string, fitted to the union bounds of those roots rather than the full
 * page. This is the clipboard `produceFlavors` override's `image/svg+xml`
 * / `text/plain` source (see `apps/draw/src/App.tsx`).
 *
 * Bounds are read directly from each root's own `pose`: a container's pose
 * is already the union-AABB of its leaf descendants (the same convention
 * the kit `group` action maintains), so no re-derivation from children is
 * needed.
 */
export function selectionToSvgString<TLayer extends string>(
  scene: Scene<WeaselDrawData, TLayer, WeaselDrawPose>,
  ids: readonly string[],
): string {
  const nodes = sceneToSvgNodes(sceneSourceOf(scene), ids);

  const bounds = unionBounds(
    ids
      .map((id) => scene.get(id as never)?.pose)
      .filter((p): p is WeaselDrawPose => p != null),
  ) ?? { x: 0, y: 0, width: 0, height: 0 };

  return serializeSvg(nodes, {
    viewBox: bounds,
    width: bounds.width,
    height: bounds.height,
    namespaces: SWILL_NAMESPACES,
  });
}
