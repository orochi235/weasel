import { toRoot, type Unit, type UnitScope } from '@weasel-js/quantity';
import { isPrefLeaf } from './helpers';
import type { PrefSection } from './groups';
import { isBuiltinPref, type PrefLeaf } from './schema';
import { prefUnit, type PrefLinearUnit } from './unit';

/**
 * The display unit of a length stored in world units and shown where `scopes`
 * (outermost first, as `sceneUnitScopes` answers) enclose it: shown in
 * `display` of the innermost scope's system, its base by default, with every
 * unit of that system accepted as typed text. A scope's `scale` converts what
 * is shown and typed; what is stored stays in world units.
 */
export function scopedPrefUnit(
  scopes: readonly UnitScope[],
  opts?: { display?: Unit; precision?: number; suffix?: string },
): PrefLinearUnit {
  const system = scopes[scopes.length - 1]!.system;
  const own = prefUnit(system, opts?.display ?? system.base, {
    ...(opts?.precision === undefined ? {} : { precision: opts.precision }),
    ...(opts?.suffix === undefined ? {} : { suffix: opts.suffix }),
  });
  // `toRoot` is affine: world = inner * k + c.
  const c = toRoot(0, scopes);
  const k = toRoot(1, scopes) - c;
  const offset = (own.offset ?? 0) * k + c;
  return { ...own, scale: own.scale * k, ...(offset === 0 ? {} : { offset }) };
}

/**
 * `leaf` as a surface showing it where `scopes` enclose the value draws it:
 * a number leaf whose `measure` is `'length'` and that names no `unit` of its
 * own takes {@link scopedPrefUnit}'s, and an object leaf's children are read
 * the same way. Every surface showing a scene node's fields reads its leaves
 * through this. The same leaf comes back where nothing changes, and with no
 * scopes.
 */
export function prefLeafInScopes<L extends PrefLeaf>(leaf: L, scopes: readonly UnitScope[] | undefined): L {
  if (!scopes || scopes.length === 0) return leaf;
  const l = leaf as PrefLeaf;
  if (isBuiltinPref(l) && l.kind === 'number' && l.measure === 'length' && !l.unit) {
    return { ...leaf, unit: scopedPrefUnit(scopes) };
  }
  if (isBuiltinPref(l) && l.kind === 'object') {
    const children = membersInScopes(l.children, scopes);
    return children === l.children ? leaf : { ...leaf, children };
  }
  return leaf;
}

function membersInScopes(
  members: Record<string, PrefLeaf | PrefSection>, scopes: readonly UnitScope[],
): Record<string, PrefLeaf | PrefSection> {
  let changed = false;
  const out = Object.fromEntries(Object.entries(members).map(([key, m]) => {
    const next = isPrefLeaf(m) ? prefLeafInScopes(m, scopes) : sectionInScopes(m, scopes);
    if (next !== m) changed = true;
    return [key, next];
  }));
  return changed ? out : members;
}

function sectionInScopes(section: PrefSection, scopes: readonly UnitScope[]): PrefSection {
  const members = membersInScopes(section.members as Record<string, PrefLeaf | PrefSection>, scopes);
  return members === section.members ? section : { ...section, members };
}
