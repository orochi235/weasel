/** A boolean group's path, from its children: see `booleanGroup.ts`. */
import type { Path } from '@weasel-js/geom';
import { booleanOfPaths, type BooleanShapeOp } from '../geometry/booleanOfPaths';
import type { DerivedDep } from './nodeFnTypes';

/** Registry key for {@link booleanOfChildren}. */
export const BOOLEAN_OF_CHILDREN = 'kit:booleanOfChildren';

const OPS: ReadonlySet<string> = new Set<BooleanShapeOp>(['union', 'intersect', 'subtract', 'exclude']);

/** The operation a boolean group's `data.boolean` names; union when it names none. */
export function booleanOpOf(data: unknown): BooleanShapeOp {
  const op = (data as { boolean?: unknown } | null | undefined)?.boolean;
  return typeof op === 'string' && OPS.has(op) ? (op as BooleanShapeOp) : 'union';
}

/** A dependency's outline in world coordinates, or `null` for one with none. */
export type DepOutline = (dep: DerivedDep<unknown>) => Path | null;

// The painters own outlines and sit above `core/`, so they hand the reader
// down when they load; until then only a derived path counts.
let outlineOf: DepOutline = (dep) => dep.path;

/** @internal Installed by the painter registry (`canvas/NodeShape`). */
export function setDepOutlineReader(read: DepOutline): void {
  outlineOf = read;
}

/**
 * A boolean group's path: `data.boolean` over its children's outlines, back
 * to front, so subtract takes everything in front from the backmost child. A
 * hidden child is no operand. `null` when no child has an outline, which
 * draws nothing.
 */
export function booleanOfChildren(
  node: { data?: unknown },
  deps: readonly (DerivedDep<unknown> | undefined)[],
): Path | null {
  const paths: Path[] = [];
  for (const dep of deps) {
    if (dep === undefined || dep.node.hidden === true) continue;
    const outline = outlineOf(dep);
    if (outline !== null) paths.push(outline);
  }
  if (paths.length === 0) return null;
  const op = booleanOpOf(node.data);
  if (paths.length === 1 && op !== 'subtract') return paths[0]!;
  return booleanOfPaths(op, paths);
}
