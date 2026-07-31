# Handoff: four follow-ups in the arbitration layer

## Status

**2026-07-31 — re-verified, still accurate, now filed.** Written 2026-07-28 and
left untracked at the repo root until it was picked up. Every one of the four
items below was checked against current `main` and all four are live verbatim:
`findConflicts` still has no caller but its own test, `matcher.ts`'s phase
score is still `? 1 : 0`, `gestureIdFor` still returns an uninterpolated
`` `pointer-mouse` ``, and `pickTopMostHit`'s doc still defers sibling z-order.
They survived the phase-table retirement (same date) untouched.

Only the *paths* drifted: the dispatcher and matcher now live under
`packages/core/src/interactions/dispatcher/`, and every line number quoted
below has moved. Trust the symbol names, not the line numbers.

All four are now in `docs/TODO.md`. This document is kept for the reasoning
that does not compress into a backlog entry — particularly the headline
finding, and "score the target, order the rules" in item 4.

**Nothing done — this is a read-only review.** Four items found while comparing
the dispatcher's specificity/fall-through design against how other systems
solve gesture arbitration (CSS cascade, Flutter's gesture arena, Blender
keymaps, VS Code `when` clauses, tldraw's `StateNode` chart).

The headline finding is that the design holds up well and doesn't need
rethinking. Scope bands dominating specificity (`matcher.ts:41`, `matchSorted`
sorts only *within* a scope) is the thing CSS took a decade to add as cascade
layers, and it's here from the start. Specificity-ordered fall-through
(`dispatcher.ts:895-1050`) is strictly stronger than CSS: a mis-ranked
candidate self-corrects when its `enabled()` declines or `start()` returns an
empty handle, so a wrong weight in the tuple degrades to "slightly wasteful"
rather than "silently wrong." That's the property that makes a hand-tuned
scoring scheme survivable at all, and it should be defended in any future
refactor.

The four items below are gaps at the edges, ordered roughly by
value-per-effort. None is urgent. Items 1 and 3 are small and self-contained;
2 and 4 want a decision before code.

---

## 1. `findConflicts` is dead code outside its own test

`packages/core/src/tools/routing/reflection/conflicts.ts:38` implements
exact-tuple overlap detection across a tool registration set — same (phase,
gesture, arg, target, modifiers) tuple declared by two or more tools, which the
dispatcher will resolve deterministically by slot order but almost certainly
not the way the author intended.

It is well-scoped. The doc comment's list of what it deliberately *doesn't*
flag is the interesting part, and it's right on every count: broad-vs-narrow
targets are what specificity is for; different modifier requirements fire on
different inputs; an action declining via `enabled()` so a lower-priority one
can take the gesture is a legitimate composition, not a conflict.

**The only caller is `conflicts.test.ts`.**

So the kit can detect the one class of genuine ambiguity it has, and never
does. Every other arbitration system that survives at scale treats ambiguity as
something to surface rather than silently break — Julia raises
`MethodError: ambiguous` rather than picking; CSS picks source order and leaves
you guessing, which is the half of CSS nobody wants to inherit. Weasel wrote
the detector and then left it on the shelf.

**Suggested fix:** call it once at tool-registry assembly under `DEV` and
`console.warn` each conflict, formatted with the existing route-string
formatter (`formatRoute`) so the message names the tuple in the grammar an
author would recognize. Cheap — the detection is already written and tested.

**Decision worth making deliberately:** whether a conflict should be a warn or
a throw. Warn is the safe default given consumer tools can register anything,
but there's an argument for throwing on conflicts between two *kit* tools,
since those are always a bug.

---

## 2. The `phase` dimension of the specificity tuple is binary, and shouldn't be

`specificity()` (`matcher.ts:94-109`) scores dimension `[2]` as:

```ts
const p = ('phase' in spec && spec.phase !== undefined) ? 1 : 0;
```

Any spec that declares a phase at all scores 1. But the phase field is a list
of `(channel, phase)` atoms with two independent wildcard axes, and the range
of how much they narrow is enormous:

| spec                                    | narrows | scores |
|-----------------------------------------|---------|--------|
| `[{ channel: '*', phase: 'initial' }]`   | barely  | 1      |
| `[{ channel: '&', phase: 'engaged' }]`   | a lot   | 1      |
| `[{ channel: 'rect', phase: 'engaged' }]`| a lot   | 1      |
| (absent)                                 | nothing | 0      |

The loose `'*'` channel form is what the kit's own ambient actions use —
`escape.ts:21`, `delete.ts:31`, `anchorEditing.ts:248` are all
`[{ channel: '*', phase: 'initial' }]`, and `cancelGesture.ts:21` is
`[{ channel: '*', phase: 'engaged' }]`. Those get the same +1 as a precise
self-channel binding would.

This is the `:where()` problem in miniature: a qualifier that narrows nothing
scoring identically to one that narrows a lot. Today the blast radius is small
because dimension `[0]` (target) dominates and phase-bearing specs are rare —
the only tool-side users are the polygon and star tools' `{ kind: 'wheel',
phase: 'engaged' }` pair, which tie on `[2]` and are correctly separated by
`mods` on `[1]` anyway. So this is pre-emptive, not a live bug.

**Suggested fix:** grade it, mirroring what `targetRank` already does for
targets:

- `2` — named channel or `&`, concrete phase (`&:engaged`, `rect:engaged`)
- `1` — `*` channel with a concrete phase, or a named channel with `*` phase
- `0` — absent, or `*:*`

Note that `*:*` should score **0**, not 1 — it is exactly equivalent to
declaring no phase at all, and scoring it 1 is the bug in its purest form.

**Watch the compat argument.** `targetRank`'s doc comment (`matcher.ts:66-73`)
makes an explicit case that its graduation couldn't reorder any pre-existing
binding, because every older form ranked 0 or 1. Any change here owes the same
argument. Given the small population of phase-bearing specs listed above, it
should be easy to make concretely — enumerate them and show the new ordering
is identical.

---

## 3. `gestureIdFor` collapses every pointer onto one channel

`dispatcher.ts:640-656`:

```ts
if (event.kind === 'pointerdown' || ... ) {
  return `pointer-mouse`;
}
```

A template literal with nothing interpolated. Every pointer — mouse, each
touch, the stylus — keys into the same in-flight handle slot, so two
simultaneous pointer gestures cannot coexist: the second `pointerdown` finds a
handle already in flight and the pump routes both pointers' moves into it.

The module JSDoc says:

> `pointer-<pointerId>`, where `pointerId` defaults to `'mouse'` (Phase 3 has
> no real pointer IDs; the React seam in Task 4 will supply the actual DOM
> pointerId).

Task 4 landed — `useGestureDispatcher` tracks `activePointers` and
`pointerPositions` keyed by real `e.pointerId`, buffers per-pointer in
`bufferedDown`, and calls `setPointerCapture(e.pointerId)`. The seam has the
id; the dispatcher just never asks for it.

**Suggested fix:** thread `pointerId` onto the pointer `InputEvent` variants
and interpolate it. Mechanical, but check three things before assuming it's a
one-liner:

- `useGestureDispatcher`'s pump paths reconstruct the gesture id from the event
  to find the handle — they'll follow automatically once the event carries the
  id, but verify none of them hardcode the literal.
- Multitouch already keys separately (`multitouch-${fingers}`), and the
  `>= 2 pointers` synthesis path runs alongside per-pointer dispatch. Confirm a
  two-finger gesture doesn't start firing two independent per-pointer drags
  *and* the multitouch handle.
- `getActiveAction()`'s "most-recently-started wins" rule is currently
  near-vacuous because there's rarely more than one pointer handle. It becomes
  load-bearing once this is fixed. It's probably still the right rule, but it
  stops being free.

**Worth deciding:** whether multi-pointer independence is actually wanted, or
whether the kit should keep one pointer gesture at a time and simply *ignore*
secondary pointers explicitly rather than aliasing them. The current behavior
is the bad third option — aliasing by accident. Either intended behavior is
defensible; this isn't.

---

## 4. Sibling z-order is unresolved in hit-picking

`packages/core/src/tools/builtin/pickTopMostHit.ts` resolves an ambiguous body
hit in three steps: empty/single short-circuit, parent/child collapse (drop any
id that is an ancestor of another id in the hit set), then "last in the array
wins" as a tiebreak. Its own doc comment closes with:

> Pure sibling z-order without a parent/child relation is not resolved here yet
> — see `docs/TODO.md`.

The parent/child collapse is the genuinely valuable half and it's done. It's
also the piece that most deserves to be load-bearing: hierarchy depth is a
*real* total order along a hit path, unlike the weights in the specificity
tuple which are hand-assigned. Every gesture question the scene graph can
answer is one the rule table doesn't have to.

The sibling tiebreak is where it stops. "Last in the array" encodes a
convention ("demos that walk their scene forward return bottom-first") that the
adapter contract doesn't actually enforce, and the doc admits as much by
telling callers who z-sort topmost-first to pre-resolve to a single-element
array.

**Suggested fix:** give the adapter an optional z-order signal — a
`getZIndex(id)` or a `compareZ(a, b)` — and use it for the sibling case,
falling back to the current array-order convention when absent. Same shape as
the existing optional `getParent`, so it composes with the collapse rather than
replacing it.

**Why this matters beyond correctness:** this is scoring where scoring is
*justified*. The weights are physical — z-order, and eventually distance to
pointer and target size for near-miss tolerance — rather than invented, which
is the opposite of the tuple in `specificity()`. The general principle worth
holding onto: **score the target, order the rules.** Anything the hit-test can
decide shouldn't be pushed into binding precedence.

---

## Not items, but noted

Two things that came up and were deliberately *not* turned into items:

- **Modifiers as routes vs. parameters.** `dispatcher.ts:459-462` states the
  policy — modifier semantics belong in separate bindings with `opts.params`,
  because that's what makes them visible to conflict detection and the
  inspector, and `modifiersOf` is the narrow escape hatch for when a modifier
  is data rather than a route. That's a good reason and the right default. The
  one case worth checking is `cloneByAltDrag` (`actions/clone/behaviors/`),
  whose `activates: (mods) => mods.alt === true` may only be consulted at drag
  start. Illustrator lets you press Alt *mid-drag* to turn a move into a
  duplicate; if `activates` is read once, that doesn't work here. Small, and
  possibly intentional.

- **`resolveAll`'s verdict surface.** `ResolvedCandidate` carries
  `would-fire` / `ineligible` / `disabled` / `shadowed` *with the specificity
  tuple attached* (`dispatcher.ts:265-279`), and `evaluateShadowed`'s docstring
  reasons carefully about why the default short-circuits. Together with the
  `__weaselDispatchLog__` ring buffer interleaving mode-switch records with
  dispatch records, this is the strongest part of the whole layer — "why didn't
  my drag fire" is usually answered by a state change rather than the dispatch
  itself, and the log is built to show that. No action needed; flagged because
  it's the thing that would be most costly to lose in a refactor.
