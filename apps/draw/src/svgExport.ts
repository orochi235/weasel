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
  type RectPath,
  type Path,
  boundsOfPath,
  translatePath,
  rectPath,
} from '@weasel-js/core';
import {
  serializeSvg,
  type SvgNode,
} from '@weasel-js/svg';

import {
  docToSerializeOptions,
  sceneToSvgNodes,
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

function pathAtPose(path: Path, pose: WeaselDrawPose): Path {
  // Rect path: pose is authoritative — emit a fresh rect from pose dims.
  if (path.kind === 'rect') {
    return {
      kind: 'rect',
      x: pose.x,
      y: pose.y,
      width: pose.width,
      height: pose.height,
    } as RectPath;
  }
  // Polygon path: translate so the path's AABB origin lands at pose.x/y.
  const b = boundsOfPath(path);
  const dx = pose.x - b.x;
  const dy = pose.y - b.y;
  return (dx === 0 && dy === 0) ? path : translatePath(path, dx, dy);
}

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
  const path = pathAtPose(data.path, pose);
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

  // Walk the container tree. `objOf` lowers a leaf's stored {data, pose}
  // to an `Obj` (pose baked into the path); `sceneToSvgNodes` stamps each
  // container's scene id onto `wd:group-id` so groups round-trip.
  const source: SceneSource = {
    roots: scene.roots.map(String),
    childrenOf: (id) => scene.childrenOf(id as never).map(String),
    kindOf: (id) => (scene.get(id as never)?.kind === 'container' ? 'container' : 'leaf'),
    objOf: (id) => {
      const node = scene.get(id as never);
      if (!node || node.kind !== 'leaf') return undefined;
      return leafToObj(id, node.data, node.pose) ?? undefined;
    },
  };
  nodes.push(...sceneToSvgNodes(source));

  return serializeSvg(nodes, docToSerializeOptions({
    title: opts.filename,
    size: { width: opts.paperWidth, height: opts.paperHeight },
    paperSize: opts.paperSize,
  }));
}
