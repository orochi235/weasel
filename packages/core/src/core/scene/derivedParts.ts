/**
 * A derived path that paints in several parts, each with its own fill and
 * stroke: the steps of a blend, the copies of a repeat.
 *
 * A derivation returns one `Path`, which is what picking, bounds and every
 * reader of `DerivedDep.path` see. {@link pathFromParts} makes that path out
 * of the parts and remembers the parts against it, so the derived-node
 * painter, handed the path, can paint each part as itself. The parts live as
 * long as the path does — in the derivation's memo.
 */
import { pathToCubicContours, cubicContoursToPath, type Path, type PolygonPath } from '@weasel-js/geom';
import {
  resolveFill, resolveStroke, type Fill, type Inherit, type PaintedFill, type PaintedStroke, type Stroke,
} from '@weasel-js/paint';

/** One painted piece of a derived path. */
export interface DerivedPart {
  path: Path;
  /** The part's fill, read as a node's is: absent paints none, and
   *  `INHERIT` takes the node's own `data.fill`. */
  fill?: Fill | Inherit | null;
  /** The part's stroke, on the same terms as `fill`. */
  stroke?: Stroke | Inherit | null;
}

/** What `part` paints, its `INHERIT` taken from `own`, the deriving node's data. */
export function resolvePartPaint(
  part: DerivedPart,
  own: { fill?: Fill | null; stroke?: Stroke | null } | null | undefined,
): { fill: PaintedFill | null; stroke: PaintedStroke | null } {
  return {
    fill: resolveFill(part.fill, resolveFill(own?.fill)),
    stroke: resolveStroke(part.stroke, resolveStroke(own?.stroke)),
  };
}

const PARTS = new WeakMap<Path, readonly DerivedPart[]>();

/**
 * One path holding every part's outline, with the parts remembered against
 * it for the painter. Return it from a `derivePath`. `null` for no parts.
 */
export function pathFromParts(parts: readonly DerivedPart[]): Path | null {
  if (parts.length === 0) return null;
  const whole = parts.length === 1 ? parts[0]!.path : concatPaths(parts.map((p) => p.path));
  // A one-part path is the part's own, which another reader may hold; the
  // painter must not mistake that path for a painted one elsewhere.
  const key = whole === parts[0]!.path ? { ...whole } as Path : whole;
  PARTS.set(key, parts);
  return key;
}

/** The parts `path` was made from by {@link pathFromParts}, or `undefined`
 *  for any other path. */
export function derivedPartsOf(path: Path | null | undefined): readonly DerivedPart[] | undefined {
  return path == null ? undefined : PARTS.get(path);
}

function concatPaths(paths: readonly Path[]): PolygonPath {
  const polys = paths.map((p) => (p.kind === 'rect' ? cubicContoursToPath(pathToCubicContours(p)) : p));
  let commands = 0;
  let coords = 0;
  for (const p of polys) {
    commands += p.commands.length;
    coords += p.coords.length;
  }
  const out: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
  let ci = 0;
  let xi = 0;
  for (const p of polys) {
    out.commands.set(p.commands, ci);
    out.coords.set(p.coords, xi);
    ci += p.commands.length;
    xi += p.coords.length;
  }
  return out;
}
