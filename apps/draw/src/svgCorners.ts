/**
 * Corner shapes in a saved file. The `<path>`'s `d` is the expanded
 * geometry any SVG reader draws; the `wd:` namespace adds the bare anchors
 * (`corner-anchors`, as path data) and the specs on them (`corners`, as
 * `index:shape:radius` entries joined by `;`, a shape being a `corner-shape`
 * keyword or a `superellipse()` parameter), so WeaselDraw reopens the
 * corners still editable.
 */
import {
  boundsOfPath,
  boxToBox,
  isCornerShape,
  pathFromD,
  transformPath,
  withoutCorners,
  type CornerShape,
  type CornerSpec,
  type Path,
  type PolygonPath,
} from '@weasel-js/geom';
import { serializePathD } from '@weasel-js/svg';

/** The `wd:` attributes that carry `path`'s corners, or none when it has no spec. */
export function cornerAttrs(path: Path): Record<string, string> {
  if (path.kind !== 'polygon' || !path.corners) return {};
  const entries: string[] = [];
  path.corners.forEach((c, i) => { if (c) entries.push(`${i}:${c.shape}:${c.radius}`); });
  if (entries.length === 0) return {};
  return { corners: entries.join(';'), 'corner-anchors': serializePathD(withoutCorners(path)) };
}

function parseCorners(text: string): (CornerSpec | null)[] | null {
  const out: (CornerSpec | null)[] = [];
  for (const entry of text.split(';')) {
    const [i, text, radius] = entry.split(':');
    const index = Number(i);
    const r = Number(radius);
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(r) || r < 0) return null;
    const shape: unknown = isCornerShape(text) ? text : text.trim() === '' ? NaN : Number(text);
    if (!isCornerShape(shape)) return null;
    while (out.length < index) out.push(null);
    out[index] = { shape: shape as CornerShape, radius: r };
  }
  return out;
}

const close = (a: number, b: number, size: number): boolean => Math.abs(a - b) <= 1e-3 * Math.max(1, size);

/**
 * `drawn`, the imported expanded path, as the bare anchors and corners that
 * `attrs` carry, placed where `drawn` sits. `drawn` itself when the
 * attributes are absent or no longer describe it.
 */
export function pathWithCorners(drawn: Path, attrs: Record<string, string> | undefined): Path {
  const text = attrs?.corners;
  const anchors = attrs?.['corner-anchors'];
  if (drawn.kind !== 'polygon' || !text || !anchors) return drawn;
  const corners = parseCorners(text);
  if (!corners) return drawn;
  let bare: PolygonPath;
  try {
    bare = pathFromD(anchors);
  } catch {
    return drawn;
  }
  const { origin: _drawnFrom, ...look } = withoutCorners(drawn);
  const spec: PolygonPath = {
    ...look, commands: bare.commands, coords: bare.coords, ...(bare.origin ? { origin: bare.origin } : {}), corners,
  };
  const from = boundsOfPath(spec);
  const to = boundsOfPath(drawn);
  const size = Math.max(to.width, to.height);
  if (!close(from.width, to.width, size) || !close(from.height, to.height, size)) return drawn;
  const m = boxToBox(from.x, from.y, from.width, from.height, to.x, to.y, to.width, to.height);
  return transformPath(spec, m);
}
