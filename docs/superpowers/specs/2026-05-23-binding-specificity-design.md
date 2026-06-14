# Binding Specificity in `matchSorted`

## Problem

`matchSorted` returns matching bindings in **scope priority order, then registration order within scope**. There is no notion of "this binding is more specific than that one." The dispatcher then iterates matches and picks the first whose action's `enabled()` returns `true`.

This works fine when bindings are differentiated by their input kind (`{ kind: 'drag' }` vs `{ kind: 'wheel' }`) — only one matches a given event. It breaks when two bindings share `kind` but one declares additional discriminating features (a target predicate or modifier requirement) that the other doesn't.

The motivating example: a drag on a bezier control handle should engage `editAnchorsAction`, not `moveAction`. Both bind `{ kind: 'drag' }`. Today's `matchSorted` returns them in registration order — `moveAction` first because it's registered first in `useStandardActions`. The dispatcher's recently-added empty-handle fallthrough means an action that early-returns `{}` defers to the next match — but `moveAction.start` returns a real handle whenever selection is non-empty, so it never defers on a control-point drag.

The same shape recurs throughout the kit: any pair of bindings where one is "general" and another is "specific" requires the specific one to be registered first AND the general one to runtime-decline whenever the specific one would have matched. The current contract is "every general-drag action must know about every specific-affordance kind that could win," which is brittle and scales poorly.

## Goal

Have `matchSorted` order matching bindings by **specificity within scope** so that a binding declaring more discriminators wins over one declaring fewer. The dispatcher's existing fall-through loop then naturally prefers the more-specific binding. Specific actions can declare their gating in the binding (declarative, visible at registration site) rather than as runtime opt-outs in every general action.

## Non-goals

- Changing scope priority (hotkey > active > ambient stays).
- Changing what `enabled()` means (it's still the action's runtime gate, distinct from the binding's specificity).
- Restructuring `useStandardActions` registration order (it should no longer matter).
- Adding affordance opt-outs to every general-drag action (the point of this change is to *remove* the need for those).

## Design

### What counts as "specificity"

CSS-style lexicographic specificity. Each binding spec has a tuple computed from declared features. Higher tuple wins.

For each `GestureSpec` (the binding's `spec` field), the score has these components in order of precedence:

1. **target present** — bindings that declare a `target` (string-form `'kind:rect'`, `'empty'`, `'selected-body'`, or function-form `(affordance, body) => boolean`) score higher than bindings with no target. Boolean (1 / 0). Function-form and string-form score equally; specific function-form selectivity is not modeled.
2. **modifier discriminators count** — number of `mods` keys present with a non-optional value. `{ shift: true }` counts as 1. `{ shift: 'optional' }` counts as 0 (it doesn't discriminate). `{ shift: true, mod: true }` counts as 2.
3. **phase present** — bindings with a `phase` field (e.g. `[engaged]` qualifier) score higher than ones without. Boolean (1 / 0).
4. **fingers / key / button match strength** — bindings that name a specific key, finger count, or mouse button are inherently exact-match, so this dimension is always 1 once the binding matches (no tie-breaking among bindings that all matched on an exact key). Included as a placeholder for symmetry; effectively unused.

So a binding's specificity is a `[target, mods, phase, exact]` tuple. Lexicographic comparison: target dimension dominates, mods next, then phase. Bindings with identical tuples fall back to registration order (the current behavior, preserved as the tiebreaker).

### Worked examples

Two bindings on `kind: 'drag'`:

```
moveAction:        { kind: 'drag' }                            → [0, 0, 0, 1]
editAnchorsAction: { kind: 'drag', target: anchorPredicate }   → [1, 0, 0, 1]
```

On a drag whose affordance matches `anchorPredicate`, both bindings match. `[1, 0, 0, 1] > [0, 0, 0, 1]`, so editAnchorsAction wins regardless of which was registered first. On a drag whose affordance does NOT match `anchorPredicate`, only `moveAction`'s binding matches at all (editAnchors's binding was filtered out at the matcher's `matchTarget` call). moveAction wins by being the only match.

A more involved case — `[engaged] drag +shift` vs `[engaged] drag`:

```
{ kind: 'drag', phase: 'engaged' }                  → [0, 0, 1, 1]
{ kind: 'drag', phase: 'engaged', mods: { shift: true } } → [0, 1, 1, 1]
```

Shift-held drags during engagement get the shift-specific binding; plain drags get the no-mods one. `mods.shift: 'optional'` would not contribute to the score, so it doesn't beat a binding that declares `shift: true`.

### Where the change lands

`matchSorted` in `packages/gestures/src/ui/match.ts`. The current implementation iterates `SCOPE_PRIORITY` outer and `bindings` inner; matches accumulate in registration order. The new implementation accumulates matches per scope, sorts each scope's matches by specificity (descending), then concatenates scopes in priority order.

```ts
function specificity(spec: GestureSpec): readonly number[] {
  // returns [target?, modsCount, phase?, 1]
}

for (const scope of SCOPE_PRIORITY) {
  const scoped = bindings
    .filter(sb => sb.scope === scope && matchSpec(...))
    .sort((a, b) => compareSpecificity(b.binding.spec, a.binding.spec));
  out.push(...scoped);
}
```

The sort is stable, so identical-specificity bindings retain registration order.

### Migration impact

Every place in the kit that relies on registration order to break a same-binding tie needs to be reviewed. Likely-affected pairs (audit needed):

- `moveAction` vs `editAnchorsAction` — current source of the bug. Fixed by giving editAnchors a target predicate.
- `moveAction` vs `rotateAction` — both bind bare `{ kind: 'drag' }` today. Rotate engages whenever selection is non-empty. Today move wins because it's registered first; under specificity ordering they're tied and move still wins (registration tiebreak). No change.
- `moveAction` vs `areaSelectAction` — same shape, same outcome.
- `insertAction` / `insertRotateAction` / `cloneAction` — same shape, no target predicates today. Continue to fall through to registration order. No change unless we add target predicates.
- Any consumer-registered action that wedged between two kit actions to take advantage of order — would need to declare specificity if it was relying on registration order.

Tests verify the contract: an integration test confirms a binding with a target predicate beats a bare-kind binding regardless of which is registered first.

### What this unlocks

- `editAnchorsAction.defaultBinding` becomes `{ kind: 'drag', target: (affordance) => isAnchorKind(affordance) }`. The bezier handle-drag spec passes.
- Future "specific action wedged into a general slot" patterns work without surgery on the general action. E.g. a hypothetical `cropAction` bound to `{ kind: 'drag', target: cropOverlayPredicate }` works in any consumer that also has `moveAction` registered.
- The dispatcher's empty-handle fallthrough remains useful — it covers the cases where specificity isn't enough (the binding matched but the action's runtime deps say "I can't actually do this").

## Open questions

1. **Function-form target vs string-form target.** Today the matcher treats both as "target predicate present" → score 1. Could string-form score higher (more declarative, presumably faster) than function-form? Probably YAGNI — both express the same kind of discrimination at the binding level.
2. **`mods.shift: 'optional'` semantics.** The proposal scores `'optional'` as 0. An alternative: `'optional'` could count as 0.5 — it's a softer constraint than absent, harder than required. The 0/1 binary is simpler and probably correct.
3. **Future-proofing for more specs.** If a new spec kind adds new discriminating fields, the specificity tuple grows. Add fields to the *end* of the tuple so earlier dimensions stay dominant; document the order in a single place near `specificity()`.
4. **Should `enabled()` returning a disabled reason ever reorder the candidate list?** No — `enabled()` is the action's runtime gate, separate from binding specificity. The existing fall-through loop handles this correctly (try most specific, fall through if disabled).

## Definition of done

- `matchSorted` orders within-scope matches by specificity (descending), then registration order.
- A unit test in `packages/gestures/src/ui/match.test.ts` covers the four-component tuple, including tiebreaks.
- `editAnchorsAction.defaultBinding` gets a function-form `target` predicate matching `anchor:*`/`controlIn:*`/`controlOut:*` affordance kinds.
- An integration test in `src/interactions/dispatcher/dispatcher.test.ts` confirms editAnchorsAction wins over moveAction on an anchor-kind affordance drag.
- `tests/e2e/bezier-edit.spec.ts` — the third spec flips from `test.fixme` to `test`.
- No regressions in the kit suite (currently 2766 tests).
- No changes to action registration order.
