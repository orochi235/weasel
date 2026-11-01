import type { Quantity } from './quantity';
import { entryScale, formatUnit, resolveUnit, type Unit, type UnitEntry, type UnitSystem, type UnitValue } from './units';

/**
 * A unit system nested in another: a sub-assembly drawn in millimeters inside
 * a scene measured in inches. Values inside are read against `system`, and
 * `scale` converts at the boundary.
 */
export interface UnitScope {
  system: UnitSystem;
  /** What one of this scope's base units is worth in the enclosing scope's
   *  base units. Absent is 1, which is also what the outermost scope has. */
  scale?: UnitEntry;
  /** How large the scope's frame is drawn in the enclosing one: a drawer's
   *  plan inset at 0.4 says 0.4. It declares a magnification that something
   *  else draws (a scale `transform` on the node), so a length measured on
   *  screen can be divided back to its true size. Absent is 1. */
  drawnAt?: number;
}

/** How large the innermost scope's frame is drawn in the outermost's: every
 *  `drawnAt` of `scopes`, multiplied. */
export function magnificationOf(scopes: readonly UnitScope[]): number {
  let m = 1;
  for (const scope of scopes) m *= scope.drawnAt ?? 1;
  return m;
}

/** A measure in the innermost scope's base units, in the outermost's. `scopes` runs outermost first. */
export function toRoot(base: number, scopes: readonly UnitScope[]): number {
  let n = base;
  for (let i = scopes.length - 1; i >= 0; i--) {
    const { factor, offset } = entryScale(scopes[i]!.scale ?? 1);
    n = n * factor + offset;
  }
  return n;
}

/** The inverse of {@link toRoot}: an outermost-scope measure in the innermost scope's base units. */
export function fromRoot(rootBase: number, scopes: readonly UnitScope[]): number {
  let n = rootBase;
  for (const scope of scopes) {
    const { factor, offset } = entryScale(scope.scale ?? 1);
    n = (n - offset) / factor;
  }
  return n;
}

/**
 * Resolve `v` where it was written — against the innermost scope's unit
 * system, so `ft` inside a metric sub-assembly is an error rather than a
 * silent inch measure — and return it in the outermost scope's base units.
 */
export function resolveScoped(v: UnitValue | Quantity, scopes: readonly UnitScope[]): number {
  return toRoot(resolveUnit(v, scopes[scopes.length - 1]?.system), scopes);
}

/** A measure in the outermost scope's base units, as text in a unit of the innermost scope. */
export function formatScoped(
  rootBase: number,
  displayUnit: Unit,
  scopes: readonly UnitScope[],
  opts?: { precision?: number; suffix?: boolean },
): string {
  return formatUnit(fromRoot(rootBase, scopes), displayUnit, scopes[scopes.length - 1]!.system, opts);
}

/** How {@link scopesOf} reads a tree it knows nothing else about. */
export interface ScopeTree<Id> {
  parentOf(id: Id): Id | null | undefined;
  /** The scope `id` declares for what it holds, when it declares one. */
  scopeOf(id: Id): UnitScope | undefined;
  /** Count `id`'s own scope too — for a value written inside it rather than
   *  one that places it in its parent. Default false. */
  inclusive?: boolean;
}

/**
 * The scopes enclosing `id`, outermost first, under `root`: what
 * {@link resolveScoped} takes for a value that positions or sizes `id`. A
 * node's own scope covers its children, not itself, unless `inclusive`.
 */
export function scopesOf<Id>(id: Id, root: UnitScope, tree: ScopeTree<Id>): UnitScope[] {
  const inner: UnitScope[] = [];
  let at: Id | null | undefined = tree.inclusive ? id : tree.parentOf(id);
  while (at !== null && at !== undefined) {
    const scope = tree.scopeOf(at);
    if (scope) inner.push(scope);
    at = tree.parentOf(at);
  }
  return [root, ...inner.reverse()];
}
