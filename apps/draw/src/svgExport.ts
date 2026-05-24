/**
 * Kit-native SVG export for the WeaselDraw scene.
 *
 * Walks `scene.renderOrder()` (back-to-front), translates each leaf node's
 * stored `data.path` to its pose origin, and emits the appropriate
 * `SvgNode`. Text leaves emit `SvgTextNode`; everything else emits
 * `SvgPathNode`. Container nodes are flattened — children are emitted at
 * the root for v1. (Group serialization is a follow-up; the existing
 * `objsToSvgNodes` pipeline could be revived once the scene tracks
 * `Group` records, but the current scene shape doesn't.)
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
} from '@orochi235/weasel';
import {
  serializeSvg,
  type SvgNode,
  type SvgPathNode,
  type SvgTextNode,
} from '@orochi235/weasel-svg';

import { docToSerializeOptions, type WeaselDrawPaperSize } from './svgInterop';

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

function leafToSvgNode(data: WeaselDrawData, pose: WeaselDrawPose): SvgNode | null {
  if (data.text != null) {
    const node: SvgTextNode = {
      kind: 'text',
      x: pose.x,
      y: pose.y,
      width: pose.width,
      height: pose.height,
      text: data.text,
    };
    if (pose.rotation) node.rotation = pose.rotation;
    return node;
  }
  if (data.path == null) return null;
  const path = pathAtPose(data.path, pose);
  const node: SvgPathNode = {
    kind: 'path',
    path,
    fill: data.fill
      ? { kind: 'solid', color: data.fill }
      : { kind: 'none' },
  };
  if (data.stroke && (data.strokeWidth ?? 0) > 0) {
    node.stroke = {
      paint: { kind: 'solid', color: data.stroke },
      width: data.strokeWidth ?? 1,
    };
  }
  if (pose.rotation) node.rotation = pose.rotation;
  return node;
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

  for (const id of scene.renderOrder()) {
    const node = scene.get(id);
    if (!node || node.kind !== 'leaf') continue;
    const svgNode = leafToSvgNode(node.data, node.pose);
    if (svgNode) nodes.push(svgNode);
  }

  return serializeSvg(nodes, docToSerializeOptions({
    title: opts.filename,
    size: { width: opts.paperWidth, height: opts.paperHeight },
    paperSize: opts.paperSize,
  }));
}
