import {
  boundsOfPath, ellipsePath, invert, linePath, mat3, multiply, rectPath, regularPolygonPath, starPath, polylineFromPoints, transformPath,
  type Affine, type Path,
} from '@weasel-js/geom';
import { getImageBitmap, type DrawCommand, type PathDrawCommand } from '@weasel-js/renderer';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { ResolvedOverlay } from 'interactions/actions/resolveOverlays';

/** Alpha for content previewed inside an in-flight gesture. Matches the
 *  preview-ghost layer, so a dragged node and an uncommitted insert read as
 *  equally provisional. */
const PREVIEW_CONTENT_OPACITY = 0.85;

/** The overlay colors an insert preview is drawn in. */
export interface InsertPreviewStyle {
  fill: string;
  stroke: string;
  lineWidth: number;
  dash: number[];
}

/** An insert preview in screen space: its outline, under each copy it will be
 *  drawn in, and the dot at the press. */
export function insertPreviewCommands(
  ov: Extract<ResolvedOverlay, { kind: 'insertPreview' }>,
  view: View,
  cfg: InsertPreviewStyle,
): DrawCommand[] {
  const t = viewToTransform(view);
  // World to screen. Every outline is built in world and carried through it, so a flipped or stretched view
  // draws the preview as it draws the node the drag inserts.
  const toScreen: Affine = [view.scale.x, 0, 0, view.scale.y, t.panX, t.panY];
  const out: DrawCommand[] = [];
  const b = ov.bounds;

  let world: Path | null = null;
  const geom = ov.geometry;
  switch (geom.kind) {
    case 'box':
      world = ov.shape === 'ellipse' ? ellipsePath(b) : rectPath(b.x, b.y, b.width, b.height);
      break;
    case 'line':
      world = linePath(geom.a, geom.b);
      break;
    case 'polygon':
      world = regularPolygonPath(geom.center, geom.radius, geom.sides, geom.rotation);
      break;
    case 'star':
      world = starPath(geom.center, geom.outerRadius, geom.points, geom.innerRadius, geom.rotation);
      break;
    case 'path':
      world = geom.path;
      break;
    case 'pencil':
      // Genuinely open: `polygonFromPoints` closes the path, and the
      // closing edge from the last sample back to the first reads as
      // a marquee rather than as the stroke being drawn.
      world = polylineFromPoints(geom.samples);
      break;
  }
  const pathCmd = world && transformPath(world, toScreen);
  if (pathCmd && geom.kind === 'box' && ov.shape === 'image') {
    const e = (typeof ov.extras === 'object' && ov.extras !== null ? ov.extras : {}) as Partial<{ src: string; preview: string }>;
    // The bitmap when it has decoded, the bare outline until then
    // (or when the tool opted out) — the outline is drawn either
    // way, so the drag always has an edge to read.
    const bmp = e.preview === 'outline' || !e.src ? undefined : getImageBitmap(e.src);
    const r = boundsOfPath(pathCmd);
    if (bmp) {
      out.push({
        kind: 'image',
        image: bmp,
        x: r.x, y: r.y, width: r.width, height: r.height,
        opacity: PREVIEW_CONTENT_OPACITY,
      });
    }
  }

  if (!pathCmd) return out;
  const cmd: PathDrawCommand = {
    kind: 'path',
    path: pathCmd,
    fill: ov.shape === 'line' || ov.shape === 'pencil' || ov.shape === 'image'
      ? undefined
      : { paint: { color: cfg.fill } },
    stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
  };
  out.push(cmd);
  // Each copy the shape will be drawn in, carried into screen space.
  if (ov.copies && ov.copies.length > 0) {
    const toWorld = invert(toScreen);
    for (const m of ov.copies) {
      if (!toWorld) break;
      const s = multiply(toScreen, multiply(m, toWorld));
      out.push({ kind: 'group', transform: mat3.fromAffine(s), children: [cmd] });
    }
  }
  // Anchor dot at the drag's click point: for radial shapes no
  // vertex sits at the AABB corner, and in center mode the dot marks
  // the growth axis.
  if (ov.anchorPoint) {
    const [ax, ay] = worldToScreen(ov.anchorPoint.x, ov.anchorPoint.y, t);
    const anchorScreen = { x: ax, y: ay };
    out.push({
      kind: 'path',
      path: ellipsePath({
        x: anchorScreen.x - 4,
        y: anchorScreen.y - 4,
        width: 8,
        height: 8,
      }),
      fill: { paint: { color: cfg.stroke } },
    });
  }
  return out;
}
