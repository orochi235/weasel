import {
  ellipsePath, invert, linePath, mat3, multiply, rectPath, regularPolygonPath, starPath, polylineFromPoints,
  type Affine,
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
  const out: DrawCommand[] = [];
  const b = ov.bounds;
  const projectPoint = (wx: number, wy: number): { x: number; y: number } => {
    const [sx, sy] = worldToScreen(wx, wy, t);
    return { x: sx, y: sy };
  };
  const projectPoints = (
    pts: ReadonlyArray<{ x: number; y: number }>,
  ): { x: number; y: number }[] => pts.map((p) => projectPoint(p.x, p.y));
  // Radial shapes inscribe in a square, so a single screen-space
  // radius needs one scale factor; average the axes.
  const radialScale = (view.scale.x + view.scale.y) / 2;

  let pathCmd: PathDrawCommand['path'] | null = null;
  const geom = ov.geometry;
  switch (geom.kind) {
    case 'box': {
      const [sx, sy] = worldToScreen(b.x, b.y, t);
      const sw = b.width * view.scale.x;
      const sh = b.height * view.scale.y;
      if (ov.shape === 'image') {
        const e = ov.extras as Partial<{ src: string; preview: string }>;
        // The bitmap when it has decoded, the bare outline until then
        // (or when the tool opted out) — the outline is drawn either
        // way, so the drag always has an edge to read.
        const bmp = e.preview === 'outline' || !e.src
          ? undefined
          : getImageBitmap(e.src);
        if (bmp) {
          out.push({
            kind: 'image',
            image: bmp,
            x: sx, y: sy, w: sw, h: sh,
            opacity: PREVIEW_CONTENT_OPACITY,
          });
        }
      }
      pathCmd = ov.shape === 'ellipse'
        ? ellipsePath({ x: sx, y: sy, width: sw, height: sh })
        : rectPath(sx, sy, sw, sh);
      break;
    }
    case 'line':
      pathCmd = linePath(projectPoint(geom.a.x, geom.a.y), projectPoint(geom.b.x, geom.b.y));
      break;
    case 'polygon':
      pathCmd = regularPolygonPath(
        projectPoint(geom.center.x, geom.center.y),
        geom.radius * radialScale,
        geom.sides,
        geom.rotation,
      );
      break;
    case 'star':
      pathCmd = starPath(
        projectPoint(geom.center.x, geom.center.y),
        geom.outerRadius * radialScale,
        geom.points,
        geom.innerRadius * radialScale,
        geom.rotation,
      );
      break;
    case 'pencil':
      // Genuinely open: `polygonFromPoints` closes the path, and the
      // closing edge from the last sample back to the first reads as
      // a marquee rather than as the stroke being drawn.
      pathCmd = polylineFromPoints(projectPoints(geom.samples));
      break;
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
    const toScreen: Affine = [view.scale.x, 0, 0, view.scale.y, t.panX, t.panY];
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
    const anchorScreen = projectPoint(ov.anchorPoint.x, ov.anchorPoint.y);
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
