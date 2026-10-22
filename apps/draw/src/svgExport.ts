/**
 * SVG export for the WeaselDraw scene. Containers become groups stamped with
 * their scene id so the structure round-trips on import; every leaf is lowered
 * to an `Obj` with its pose baked into the path. Rotation is not baked: it
 * rides on the node so the serializer emits a `rotate` transform.
 */
import {
  type Fill,
  type Path,
  type Scene,
  type Stroke,
  boundsOfPath,
  composesFrames,
  composeWorldPose,
  definesFrame,
  derivedDepOf,
  documentPose,
  embedWeaselMetadataInSvg,
  inheritedPaintIn,
  withInheritedPaint,
  fillInPoseFrame,
  isAnnotationNode,
  layoutTextPose,
  pathEffectOf,
  pathEffectParts,
  resolveFill,
  resolvePartPaint,
  resolveStroke,
  pathInPoseFrame,
  shapeGeneratorOf,
  unionAABB,
  type ShapeGenerator,
} from '@weasel-js/core';
import {
  serializeSvg,
  warmSvg,
  type SerializeOptions,
  type SvgNode,
} from '@weasel-js/svg';

import {
  backgroundSvgNode,
  docToSerializeOptions,
  sceneToSvgNodes,
  SWILL_NAMESPACES,
  type SceneSource,
  type WeaselDrawPaperSize,
} from './svgInterop';
import type { WeaselDrawData, WeaselDrawPose } from './drawDocument';
import type { EffectObj } from './svgEffects';
import type { ImageObj, Obj, PathObj, PathParams, TextObj } from './svgObj';

/** A node's data with its `'inherit'` paint resolved, as export writes it. */
type ShownDrawData = ReturnType<typeof withInheritedPaint<WeaselDrawData>>;

const WHITE = /^#?fff(fff)?(ff)?$/i;

/** A polygon's or a star's generator as the `tool` and `params` the `wd:` namespace carries. */
function toolOfGenerator(g: ShapeGenerator): { tool: 'polygon' | 'star'; params: PathParams } {
  return g.kind === 'polygon'
    ? { tool: 'polygon', params: { sides: g.sides, rotation: g.rotation } }
    : { tool: 'star', params: { points: g.points, ratio: g.innerRadiusRatio, rotation: g.rotation } };
}

/** Lower a leaf node's `{data, pose}` to an `Obj`, or `null` for a leaf with
 *  no drawable data. */
function leafToObj(id: string, data: ShownDrawData, pose: WeaselDrawPose): Obj | null {
  if (data.image) {
    const o: ImageObj = {
      id, tool: 'image', x: pose.x, y: pose.y, width: pose.width, height: pose.height, image: data.image,
    };
    if (pose.rotation) o.rotation = pose.rotation;
    return o;
  }
  if (data.text != null) {
    const o: TextObj = {
      id,
      tool: 'text',
      x: pose.x, y: pose.y, width: pose.width, height: pose.height,
      text: data.text,
    };
    const style = data.style;
    if (style && Object.keys(style).length > 0) o.style = style;
    if (data.runs && data.runs.length > 0) o.runs = data.runs;
    o.fill = resolveFill(data.fill);
    const stroke = resolveStroke(data.stroke);
    if (stroke) o.stroke = stroke;
    if (data.verticalAlign) o.verticalAlign = data.verticalAlign;
    if (pose.rotation) o.rotation = pose.rotation;
    return o;
  }
  if (data.path == null) return null;
  const generator = shapeGeneratorOf(data);
  return {
    ...pathObj(id, pathInPoseFrame(data.path, pose), pose, data.fill, data.stroke),
    ...(generator ? toolOfGenerator(generator) : {}),
  };
}

/** A path already in page coordinates, boxed by `pose`, as a `PathObj`. */
function pathObj(
  id: string,
  path: Path,
  pose: WeaselDrawPose,
  fill: Fill | null | undefined,
  stroke: Stroke | null | undefined,
): PathObj {
  const painted = { fill: resolveFill(fill), stroke: resolveStroke(stroke) };
  const o: PathObj = {
    id,
    tool: 'imported',
    x: pose.x, y: pose.y, width: pose.width, height: pose.height,
    path,
    // The path above is baked into page coordinates, and the serializer
    // emits gradients as `userSpaceOnUse` — so a box-relative gradient has
    // to be resolved against the same pose.
    fill: painted.fill && { ...painted.fill, paint: fillInPoseFrame(painted.fill.paint, pose) },
    stroke: painted.stroke && { ...painted.stroke, paint: fillInPoseFrame(painted.stroke.paint, pose) },
  };
  if (pose.rotation) o.rotation = pose.rotation;
  return o;
}

/** A live path effect as the paths it shows — what Expand to Paths would
 *  make of it, each part in its own paint — with what keeps it live. */
function effectToObj<TLayer extends string>(scene: DrawScene<TLayer>, id: string): EffectObj {
  const node = scene.get(id as never)!;
  const dependsOn = (Array.isArray(node.dependsOn) ? node.dependsOn : []).map(String);
  const deps = dependsOn.map((d) => derivedDepOf(scene, d as never, node));
  const parts = (pathEffectParts(node, deps) ?? []).map((part, k) => {
    const { x, y, width, height } = boundsOfPath(part.path);
    const { fill, stroke } = resolvePartPaint(part, node.data as WeaselDrawData, inheritedPaintIn(scene, node));
    return pathObj(`${id}-${k}`, part.path, { x, y, width, height }, fill, stroke);
  });
  return { id, effect: pathEffectOf(node)!, dependsOn, parts };
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
  /** Told what the SVG cannot carry the way the canvas draws it. */
  onWarn?: (message: string) => void;
}

type DrawScene<TLayer extends string> = Scene<WeaselDrawData, TLayer, WeaselDrawPose>;

/** The pose every export reader lowers a node at: the document pose (derived
 *  where the node derives one, never a gesture's override), composed to world
 *  when the scene's composition makes it local. */
function poseOfIn<TLayer extends string>(
  scene: DrawScene<TLayer>,
): (id: string) => WeaselDrawPose | undefined {
  const stored = (id: string) => {
    const node = scene.get(id as never);
    return node === undefined ? undefined : documentPose(scene, node);
  };
  if (!composesFrames(scene.composition)) return stored;
  const adapter = {
    getPose: (id: string) => stored(id)!,
    getParent: (id: string) => {
      const parent = scene.get(id as never)?.parent;
      return parent == null ? null : String(parent);
    },
    definesFrame: (id: string) => {
      const node = scene.get(id as never);
      return node === undefined || definesFrame(node);
    },
  };
  return (id) =>
    stored(id) === undefined ? undefined : composeWorldPose(adapter, id, scene.composition.compose);
}

/** The `SceneSource` `sceneToSvgNodes` walks. `isPainted` drops what a hidden
 *  layer holds, so an export carries what the pixel path draws, and what an
 *  annotation layer holds, which is never printed. */
function sceneSourceOf<TLayer extends string>(
  scene: DrawScene<TLayer>,
  poseOf: (id: string) => WeaselDrawPose | undefined,
): SceneSource {
  const hidden = new Set(
    (scene.layers ?? []).filter((l) => !l.visible).map((l) => String(l.id)),
  );
  return {
    roots: scene.roots.map(String),
    childrenOf: (id) => scene.childrenOf(id as never).map(String),
    get: (id) => scene.get(id as never),
    isPainted: (id) => {
      const layer = scene.get(id as never)?.layer;
      return layer === undefined || (!hidden.has(String(layer)) && !isAnnotationNode(scene as never, id));
    },
    objOf: (id) => {
      const node = scene.get(id as never);
      if (!node || node.kind !== 'leaf') return undefined;
      if (pathEffectOf(node) !== null) return effectToObj(scene, id);
      return leafToObj(id, withInheritedPaint(node.data, inheritedPaintIn(scene, node)), poseOf(id)!) ?? undefined;
    },
  };
}

/**
 * `serializeSvg` once every paint kind and face `nodes` export with has
 * loaded. A load that fails is reported through `onWarn` and the export goes
 * ahead without that def. Text is written in the lines the canvas lays it out
 * into, so a reader that cannot wrap or justify still draws it as drawn.
 */
async function serializeWarm(nodes: SvgNode[], given: SerializeOptions): Promise<string> {
  const opts: SerializeOptions = { ...given, textLayout: layoutTextPose };
  try {
    await warmSvg(nodes, opts);
  } catch (err) {
    opts.onWarn?.(`a paint kind or font this export uses failed to load: ${String(err)}`);
  }
  return serializeSvg(nodes, opts);
}

/**
 * Serialize a WeaselDraw scene to an SVG document string. The scene is read
 * when this is called; only the serialization waits for lazily loaded paint
 * kinds.
 */
export function sceneToSvgString<TLayer extends string>(
  scene: DrawScene<TLayer>,
  opts: SceneToSvgOptions,
): Promise<string> {
  const nodes: SvgNode[] = [];

  // Background — prepend so it paints first (SVG paint order is document
  // order). Omit when white-equivalent to keep the file small.
  if (!WHITE.test(opts.backgroundColor)) {
    nodes.push(backgroundSvgNode(opts.backgroundColor, opts.paperWidth, opts.paperHeight));
  }

  nodes.push(...sceneToSvgNodes(sceneSourceOf(scene, poseOfIn(scene))));

  return serializeWarm(nodes, {
    ...docToSerializeOptions({
      title: opts.filename,
      size: { width: opts.paperWidth, height: opts.paperHeight },
      paperSize: opts.paperSize,
    }),
    ...(opts.onWarn ? { onWarn: opts.onWarn } : {}),
  });
}

/**
 * Recover the true selected roots from a `ClipboardSnapshot.items` list.
 *
 * A copied container's snapshot flattens its full subtree alongside it — not
 * just the ids the user selected. Feeding every item's id to
 * {@link selectionToSvgString} as a walk root would emit descendants twice:
 * nested under the exported `<g>`, and again as top-level siblings. An item is
 * a root when its captured `parent` is null or wasn't itself captured.
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
 * Serialize a subset of a WeaselDraw scene — the given root ids and, for
 * containers, their descendants — to an SVG document string, fitted to the
 * union bounds of those roots rather than the full page.
 *
 * Bounds are read from each root's own world pose: a container's pose is
 * already the union-AABB of its leaf descendants.
 */
export function selectionToSvgString<TLayer extends string>(
  scene: DrawScene<TLayer>,
  ids: readonly string[],
): Promise<string> {
  const poseOf = poseOfIn(scene);
  const nodes = sceneToSvgNodes(sceneSourceOf(scene, poseOf), ids);

  const bounds = unionAABB(
    ids
      .map(poseOf)
      .filter((p): p is WeaselDrawPose => p != null),
  ) ?? { x: 0, y: 0, width: 0, height: 0 };

  return serializeWarm(nodes, {
    viewBox: bounds,
    width: bounds.width,
    height: bounds.height,
    namespaces: SWILL_NAMESPACES,
  });
}

/**
 * {@link selectionToSvgString} plus the weasel clipboard payload embedded in
 * a `<metadata>` element — the string that goes on `image/svg+xml` AND
 * `text/plain`. A draw→draw DOM paste, where Chromium exposes ONLY
 * `text/plain`, reads the payload back and keeps full JSON fidelity.
 *
 * `weaselPayloadText` must be the SAME text the custom-MIME JSON flavor
 * carries, so every flavor of one copy decodes to one payload.
 */
export async function selectionToClipboardSvgString<TLayer extends string>(
  scene: DrawScene<TLayer>,
  ids: readonly string[],
  weaselPayloadText: string,
): Promise<string> {
  return embedWeaselMetadataInSvg(
    await selectionToSvgString(scene, ids),
    weaselPayloadText,
  );
}
