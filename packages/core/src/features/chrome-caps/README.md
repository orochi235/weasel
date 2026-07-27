# chrome-caps

Declarative visibility for overlay chrome — and, as it turned out, the kit's
general-purpose rule grammar.

Design doc: [`docs/superpowers/specs/2026-05-24-chrome-caps-design.md`](../../../../../docs/superpowers/specs/2026-05-24-chrome-caps-design.md).

## What problem it solves

"When should the rotation handle show?" used to be answered in two places: an
early-return inside the overlay layer's `draw()`, and a separate guard inside
the affordance layer's `regions()`. The two drifted, and the failure mode is
nasty — chrome you can see but can't grab, or can grab but can't see.

chrome-caps gives each user-visible chrome element a **stable id** and puts the
"when" in **one rules table**. Paint and hit-test both ask the same
`isVisible(id)`, so visible-is-hittable holds by construction rather than by
discipline:

- `features/selection/overlay.ts` — paints `selection.outline`,
  `selection.resize-handles`, `selection.rotation-handle`
- `canvas/affordanceAt.ts` — hit-tests the same three ids
- `affordances/composeAffordanceLayer.ts` — filters regions by `a.id`
- `canvas/SceneCanvas/useDispatcherOverlayLayer.ts` — gates dispatcher overlays

## The second job: eligibility

The `Rule` grammar outgrew chrome. It's now how the kit expresses **any**
"is this allowed right now" question:

- `interactions/dispatcher/dispatcher.ts` filters gesture candidates through
  `evaluate(action.eligible, ruleCtx)` before matching.
- `interactions/actions/registry.tsx` types `Action.eligible` as
  `Rule | Condition`.

That's why `RuleCtx` lives here and carries `mode` / `allowedCapabilities`
alongside the chrome-shaped fields — the grammar is shared, so the context is
too. If you're reaching for this directory because of `eligible`, you're in
the right place despite the name.

## Files

| File | Role |
| --- | --- |
| `rule.ts` | The grammar: `Selector` leaves, `all`/`any`/`not`/`when` nodes, type guards, and `evaluate()`. The whole language is ~130 lines. |
| `ruleCtx.ts` | `RuleCtx` — the live per-frame state rules read. Built once per frame and discarded. |
| `conditions.ts` | Fluent atoms (`focused`, `selectionAtLeast(1)`, `modeNot('path-edit')`, …) that compile to `Rule` trees, plus `and`/`or`/`not` and the `when` escape hatch. |
| `defaults.ts` | The kit's shipped rules table. Written as literal trees so each rule's inputs are visible at a glance. |
| `resolve.ts` | Merges consumer rules over defaults and closes over ctx → `(id) => boolean`. |
| `types.ts` | `ChromeId`, `VisibilityRules`, `Condition`, and the legacy `ChromeCtx` alias. |
| `buildChromeCtx.ts` | Assembles a `ChromeCtx` from canvas state. |
| `useHoverTracking.ts` | Ref-based last-hovered-node tracker feeding the `hovering` atoms. Deliberately doesn't re-render. |

## Two ways to write a rule

Both forms are valid anywhere a rule is accepted; `resolveVisibility`
normalizes at lookup time.

```ts
// Literal tree — preferred in defaults.ts, since the dependencies are visible.
'selection.resize-handles': {
  all: [
    { selection: { atLeast: 1 } },
    { not: { gesturing: true } },
    { mode: { not: 'path-edit' } },
    { resizable: true },
  ],
}

// Fluent — compiles to the same tree.
selectionAtLeast(1).andNot(gesturing).and(modeNot('path-edit')).and(resizable)
```

**Chains are strict left-to-right with no boolean precedence.**
`a.or(b).and(c)` is `(a || b) && c`, *not* `a || (b && c)`. When mixing `.and`
and `.or`, use the top-level `and(...)` / `or(...)` helpers or name the
subexpression — don't rely on precedence intuition that doesn't apply here.

## Consumer surface

Override per id via `<SceneCanvas chromeVisibility={...}>`. Absent ids fall
through to the kit defaults; ids with no default rule are visible.

```tsx
import { never, selectionAtLeast, zoomAtLeast } from '@weasel-js/core';

<SceneCanvas
  chromeVisibility={{
    'snap.guides': never,                                  // off entirely
    'selection.outline': selectionAtLeast(1).and(zoomAtLeast(0.5)),
  }}
/>
```

`ChromeId` is an open union (`| (string & {})`), so consumers can register
their own ids and gate their own overlays through the same table.

## Notes for the next person

- **Prefer `capability:` over `mode:`.** A capability rule keeps working when a
  new mode is added that allows the same capability; a mode rule has to be
  found and edited. `defaults.ts` follows this: transform chrome gates on
  `capability: 'transforms-selection'`, and the selection outline on
  `capability: { not: 'edits-anchors' }`. The `path-edit.*` ids are the
  deliberate exception — they're the visual signature of one specific mode,
  not a claim about what the user may do.
- **An empty capability set is not a safe default.** "No modes wired" means
  *everything the default mode permits*; the empty set would make every
  `capability:` rule false and silently hide the chrome it gates. Both
  fallback paths (`resolve.ts` for legacy `ChromeCtx`, `SceneCanvas` when
  `getActiveMode` is absent) use `DEFAULT_ALLOWED_CAPABILITIES`. Keep it that
  way when adding a third.
- **`when` is the escape hatch, not the default.** Its closure is opaque to
  introspection, which costs the Bundle Inspector and any future rule-diffing
  its ability to explain *why* something is hidden. Reach for a declarative
  selector first; add a new `Selector` key if none fits (that's an additive
  change — existing rules don't move).
- **Empty `all` is true, empty `any` is false.** Hence `ALWAYS = { all: [] }`
  and `NEVER = { any: [] }`.
- **No memoization.** Predicates are O(1) and run once per chrome id per frame.
  Profile before adding any.
- **`ChromeCtx` is legacy.** It's `RuleCtx` minus `mode` / `allowedCapabilities`;
  `resolveVisibility` fills in `mode: 'normal'` and an empty capability set for
  callers still in that shape. New code should build a `RuleCtx`.
- **`selectionResizable` absent means resizable.** Only an explicit `false` opts
  a selection out of resize handles — back-compat for ctx builders predating
  the flag.
