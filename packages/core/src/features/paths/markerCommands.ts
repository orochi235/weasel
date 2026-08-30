/**
 * Turning a stroke's markers into draw commands.
 *
 * Separate `PathDrawCommand`s rather than triangles appended to the stroke
 * ribbon: an entry may carry a fill and an outline at once, or a paint that
 * differs from the line's, neither of which one mesh can express — and folding
 * them in would drag the whole marker vocabulary into the ribbon cache key.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import type { Path, PolygonPath } from '../../core/geometry/path';
import type { PathDrawCommand } from '../../renderer/DrawCommand';
import { getMarker, type MarkerEntry, type MarkerPaint } from '../../core/strokeMarkers';
import { markerKeyOf, resolveMarkerSize } from '../../core/markerInset';
import { extractPolylines } from './tessellate/polyline';
import { markerSites, type MarkerSite } from './markerSites';

/** Rotate + translate a marker's geometry onto its site. */
function placed(path: Path, site: MarkerSite): PolygonPath {
  const src = path as PolygonPath;
  const cos = Math.cos(site.angle);
  const sin = Math.sin(site.angle);
  const coords = new Float32Array(src.coords.length);
  for (let i = 0; i < src.coords.length; i += 2) {
    const x = src.coords[i], y = src.coords[i + 1];
    coords[i] = site.x + x * cos - y * sin;
    coords[i + 1] = site.y + x * sin + y * cos;
  }
  return { kind: 'polygon', commands: src.commands, coords, fillRule: src.fillRule };
}

function resolvePaint(p: MarkerPaint | undefined, stroke: Stroke, fallback: MarkerPaint) {
  const v = p ?? fallback;
  if (v === 'none') return undefined;
  return v === 'line' ? stroke.paint : v;
}

function commandFor(
  entry: MarkerEntry, ref: MarkerRef, stroke: Stroke, strokeWidth: number, site: MarkerSite,
): PathDrawCommand | null {
  const size = resolveMarkerSize(ref, strokeWidth);
  const geometry = entry.path({ size, stroke });
  const angle = entry.orient === undefined || entry.orient === 'auto' ? site.angle : entry.orient;
  const path = placed(geometry, { ...site, angle });

  const fill = resolvePaint(entry.fill, stroke, 'line');
  const outline = entry.outline
    ? {
        paint: resolvePaint(entry.outline.paint, stroke, 'line'),
        width: entry.outline.width * size,
      }
    : null;
  if (fill === undefined && (outline === null || outline.paint === undefined)) return null;

  return {
    kind: 'path',
    path,
    ...(fill ? { fill } : {}),
    ...(outline && outline.paint
      ? { stroke: { paint: outline.paint, width: outline.width, cap: 'round', join: 'round' } }
      : {}),
  };
}

/**
 * Every marker command for `path` under `stroke`. `strokeWidth` is the already
 * width-resolved stroke width; `flattenTolerance` matches what the ribbon used,
 * so markers land on the same flattened vertices the stroke did.
 */
export function markerDrawCommands(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
): PathDrawCommand[] {
  const want = {
    start: stroke.markerStart !== undefined,
    mid: stroke.markerMid !== undefined,
    end: stroke.markerEnd !== undefined,
  };
  if (!want.start && !want.mid && !want.end) return [];

  const refFor = (role: MarkerSite['role']): MarkerRef | undefined =>
    role === 'start' ? stroke.markerStart : role === 'mid' ? stroke.markerMid : stroke.markerEnd;

  const out: PathDrawCommand[] = [];
  for (const pl of extractPolylines(path, { flattenTolerance })) {
    for (const site of markerSites(pl, want)) {
      const ref = refFor(site.role);
      if (ref === undefined) continue;
      const entry = getMarker(markerKeyOf(ref));
      if (entry === undefined) continue;
      const cmd = commandFor(entry, ref, stroke, strokeWidth, site);
      if (cmd) out.push(cmd);
    }
  }
  return out;
}
