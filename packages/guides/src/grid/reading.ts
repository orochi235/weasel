import {
  axisUnits, resolveScoped, resolveUnit, type PlaneUnits, type UnitScope,
} from '@weasel-js/core';
import { resolveGridLines, type GridLength, type GridLines, type GridSpacing } from './axes';

/** How a grid reads the unit scopes a scene's containers declare
 *  (`GroupNode.units`). */
export interface GridScopes {
  /** The scene's outermost scope, as `sceneUnitScopes` is handed it. The grid's
   *  `spacing` is read in its system, in place of `unitSystem`. */
  root: UnitScope;
  /** The grid inside a container's scope, written in that scope's units.
   *  Default: the grid's `spacing`, read there, so a bare 10 is ten of its
   *  base units. */
  spacing?: (scope: UnitScope) => GridSpacing;
}

/** A length in `chain`'s innermost units, in world units. Grid lengths are
 *  measured from the grid's origin, so a unit that disagrees about zero
 *  moves them nowhere. */
function span(v: GridLength, chain: readonly UnitScope[]): number {
  const zero = typeof v === 'number' ? 0 : { ...v, value: 0 };
  return resolveScoped(v, chain) - resolveScoped(zero, chain);
}

/**
 * A grid's lines in world units: read in `chain` (the root alone by default)
 * when `scopes` is given, else against `unitSystem`. What every grid reader
 * that takes both asks.
 */
export function gridLines(
  spacing: GridSpacing,
  unitSystem: PlaneUnits | undefined,
  scopes: GridScopes | undefined,
  chain?: readonly UnitScope[],
): GridLines {
  if (!scopes) return resolveGridLines(spacing, (v, axis) => resolveUnit(v, axisUnits(unitSystem, axis)));
  const at = chain ?? [scopes.root];
  return resolveGridLines(spacing, (v) => span(v, at));
}

/** The grid a container whose scopes are `chain` runs when nothing gives it
 *  one of its own: `scopes.spacing` of its innermost scope, else `spacing`. */
function scopeSpacing(
  spacing: GridSpacing, scopes: GridScopes | undefined, chain: readonly UnitScope[] | undefined,
): GridSpacing {
  const inner = chain && chain.length > 1 ? chain[chain.length - 1]! : null;
  return inner && scopes?.spacing ? scopes.spacing(inner) : spacing;
}

/** A container's lattice in its own coordinates: its `own` grid (`gridOf`;
 *  `null` for none), else the one its scope gives, read in `chain`. */
export function containerLines(
  own: GridSpacing | null | undefined,
  spacing: GridSpacing,
  unitSystem: PlaneUnits | undefined,
  scopes: GridScopes | undefined,
  chain: readonly UnitScope[] | undefined,
): GridLines | null {
  if (own === null) return null;
  return gridLines(own ?? scopeSpacing(spacing, scopes, chain), unitSystem, scopes, chain);
}
