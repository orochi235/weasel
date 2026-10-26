import { resolveAxes, resolveScoped, type PerAxis, type PlaneUnits, type PlaneValue, type UnitScope } from '@weasel-js/core';

/** How a grid reads the unit scopes a scene's containers declare
 *  (`GroupNode.units`). */
export interface GridScopes {
  /** The scene's outermost scope, as `sceneUnitScopes` is handed it. The grid's
   *  `spacing` is read in its system, in place of `unitSystem`. */
  root: UnitScope;
  /** The pitch inside a container's scope, written in that scope's units.
   *  Default: the grid's `spacing`, read there, so a bare 10 is ten of its
   *  base units. */
  spacing?: (scope: UnitScope) => PlaneValue;
}

type Axial = Exclude<PlaneValue, PerAxis<unknown>>;

/** A length in `chain`'s innermost units, in world units. A pitch is a span,
 *  so a unit that disagrees about zero moves it nowhere. */
function span(v: Axial, chain: readonly UnitScope[]): number {
  const zero = typeof v === 'number' ? 0 : { ...v, value: 0 };
  return resolveScoped(v, chain) - resolveScoped(zero, chain);
}

/**
 * A grid's pitch on each axis, in world units, where `chain` (outermost
 * first, rooted at `scopes.root`) encloses it: `spacing` in the root, and
 * `scopes.spacing` of the innermost scope inside a container's.
 */
export function scopedGridPitch(spacing: PlaneValue, scopes: GridScopes, chain: readonly UnitScope[]): PerAxis<number> {
  const inner = chain.length > 1 ? chain[chain.length - 1]! : null;
  const v = inner && scopes.spacing ? scopes.spacing(inner) : spacing;
  const on = (axis: 'x' | 'y'): number => {
    const a = typeof v === 'object' && 'x' in v ? v[axis] : v;
    try {
      return span(a, chain);
    } catch (e) {
      throw new Error(`${axis} axis: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return { x: on('x'), y: on('y') };
}

/**
 * A grid's pitch in world units: read in `chain` (the root alone by default)
 * when `scopes` is given, else against `unitSystem`. What every grid reader
 * that takes both asks.
 */
export function gridPitch(
  spacing: PlaneValue,
  unitSystem: PlaneUnits | undefined,
  scopes: GridScopes | undefined,
  chain?: readonly UnitScope[],
): PerAxis<number> {
  return scopes ? scopedGridPitch(spacing, scopes, chain ?? [scopes.root]) : resolveAxes(spacing, unitSystem);
}
