import { parseTargetSpec } from './match';
import type { GestureSpec, ModSpec, PhaseSpec, TargetSpec } from './spec';
import type { PhaseAtom } from '../grammar/routeGrammar';

/** Count modifier keys declared as `required` (`true`). `'optional'`,
 *  `false`, and `undefined` do NOT discriminate — they don't count. */
function modsCount(mods: ModSpec | undefined): number {
  if (!mods) return 0;
  let n = 0;
  if (mods.alt === true) n++;
  if (mods.ctrl === true) n++;
  if (mods.meta === true) n++;
  if (mods.mod === true) n++;
  if (mods.shift === true) n++;
  return n;
}

/**
 * Rank a `TargetSpec` by how much it narrows. Graduated so a target that
 * names a specific thing outranks one that only names a class of things:
 *
 *    3 — `kind:<k>:selected`: this kind AND in the selection
 *    2 — `kind:<k>` / `affordance:<k>`: one named kind
 *    1 — `'empty'` / `'selected-body'` / `'unselected-body'` / `{ kindOf }`
 *    0 — no target
 *
 * A predicate stays at 1 because its narrowness is unknowable statically —
 * `hit == null` and `isRotateHandle` are the same shape here. That is also
 * what keeps this addition from reordering any binding that existed before
 * the `kind:`/`affordance:` forms resolved: every one of them ranks 0 or 1.
 */
function targetRank(target: TargetSpec | undefined): number {
  if (target === undefined) return 0;
  const form = parseTargetSpec(target);
  if (form === null) return 1;
  switch (form.form) {
    case 'kind': return form.requireSelected ? 3 : 2;
    case 'affordance': return 2;
    case 'body': return 1;
    case 'predicate': return 1;
    default: {
      const _exhaustive: never = form;
      void _exhaustive;
      return 1;
    }
  }
}

function specTargetOf(spec: GestureSpec): TargetSpec | undefined {
  return 'target' in spec ? spec.target : undefined;
}

/**
 * Rank a `PhaseSpec` by how much it narrows, on the same graduated principle
 * as `targetRank`. A phase atom constrains two axes — which channel, and its
 * lifecycle state — and each may be wildcarded:
 *
 *    2 — both concrete: `{ channel: '&' | '<toolId>', phase: 'initial' }`,
 *        which is also what the bare-keyword shorthand desugars to
 *    1 — one axis wildcarded: `{ channel: '*', phase: 'engaged' }`
 *    0 — `{ channel: '*', phase: '*' }`, or no `phase` field at all
 *
 * The `*:*` case scoring 0 is the point: it matches everything `matchPhase`
 * would have matched with no spec, so grading it above an undeclared phase
 * would let a binding buy precedence with a constraint that constrains
 * nothing — CSS's `:where()` problem.
 *
 * An atom list is a union (`matchPhase` returns true when ANY atom matches),
 * so the list is as broad as its broadest atom and takes the **minimum**.
 *
 * Compat: every phase-bearing spec in the tree keeps its score or rises, and
 * none reorders. The four ambient actions (`escape`, `delete`,
 * `anchorEditing`, `cancelGesture`) all declare `{ channel: '*', phase:
 * <concrete> }` and stay at 1; the polygon and star tools' `phase: 'engaged'`
 * wheel bindings desugar to a concrete `&` atom and rise 1 → 2, which only
 * widens a gap they already won. Nothing in the tree declares `*:*`.
 */
function phaseRank(spec: PhaseSpec | undefined): number {
  if (spec === undefined) return 0;
  const atoms = typeof spec === 'string'
    ? [{ channel: '&', phase: spec } as PhaseAtom]
    : spec;
  if (atoms.length === 0) return 0;
  let min = 2;
  for (const a of atoms) {
    const rank = (a.channel === '*' ? 0 : 1) + (a.phase === '*' ? 0 : 1);
    if (rank < min) min = rank;
  }
  return min;
}

/** CSS-style specificity tuple for a GestureSpec. Higher tuple wins under
 *  lexicographic compare. Dimensions, in order of precedence:
 *
 *    [0] target — how much the spec's target narrows; see `targetRank`.
 *    [1] mods   — count of required modifier keys (shift/alt/ctrl/meta/mod).
 *                 `'optional'` does NOT count.
 *    [2] phase  — how much the spec's `phase` narrows; see `phaseRank`.
 *    [3] exact  — per-kind tiebreak: 2 for a drop/paste spec with a
 *                 non-empty `types` MIME filter, else 1.
 *
 *  Identical tuples fall back to registration order in the matcher's
 *  stable sort, preserving the pre-specificity tiebreaker. */
export function specificity(
  spec: GestureSpec,
): readonly [number, number, number, number] {
  const t = targetRank(specTargetOf(spec));
  const mods = ('mods' in spec ? spec.mods : undefined) as ModSpec | undefined;
  const m = modsCount(mods);
  const p = phaseRank(('phase' in spec ? spec.phase : undefined) as PhaseSpec | undefined);
  // Per-kind tiebreak: a MIME-typed drop/paste spec beats an untyped one
  // in the same scope (a consumer's `types: ['text/csv']` binding should
  // win over the kit's catch-all ingest binding).
  const typed =
    (spec.kind === 'drop' || spec.kind === 'paste') &&
    spec.types !== undefined && spec.types.length > 0
      ? 2 : 1;
  return [t, m, p, typed];
}
