# Mode-aware dispatch via declarative selector trees

## Problem

The kit has three independent gates that decide "is this thing active right now":

1. **Mode → tool eligibility.** `eligibleForMode` filters tools by capability tag against `ModeDefinition.allows`. Works correctly.
2. **chrome-caps visibility.** `(ChromeCtx) => boolean` predicates gate which UI chrome paints. Currently expressed as fluent closures — opaque after construction.
3. **Action dispatch.** `matchSorted` finds candidate bindings, the dispatcher tries them in order; `action.enabled()` is the only programmable gate. Mode is not consulted.

These gates drift because they share no vocabulary. The recently-discovered "drag an anchor → resize fires" bug in path-edit mode is a direct consequence: `moveAction`/`resizeAction` aren't mode-filtered, and the affordance pipeline that classifies hits as `handle:top-left` doesn't consult chrome-caps. So even though `suppressedIds` correctly tags the editing polygon, the resize handle paints AND hit-tests because two of the three gates don't honor suppression.

The deeper problem is that the gating system is **closure-based and per-consumer**: each consumer of "should this be on" runs its own opaque predicate, so:

- The same logical question ("is this chrome active in path-edit?") has to be re-encoded in every consumer that cares — defaults.ts, the affordance pipeline, the selection-overlay layer.
- Drift between consumers is the default outcome, not the rare failure.
- The system can't introspect itself — there's no way to ask "what is on right now in this mode" without executing every rule.

`suppressedIds` was an attempt to centralize one such concept, but only the selection-outline path honors it, and it's a blacklist of node ids when the natural framing for mode-driven gating is a whitelist of chrome/action ids.

## Goal

A single declarative system that gates chrome visibility, affordance classification, and action eligibility from the same source of truth, with mode as a first-class selector dimension. The dispatcher should be a reliable mechanism whose behavior is determined by the table, not by per-consumer closure logic.

## Design

### Rule grammar — an inspectable JSON tree

Replace the closure-typed `Condition` with a data structure:

```ts
// A selector is a conjunction of key/value tests. Multiple keys AND together.
interface Selector {
  selection?: { is?: number; atLeast?: number; empty?: boolean };
  mode?: string | readonly string[] | { not: string } | { in: readonly string[] };
  capability?:
    | CapabilityTag                              // single — must be allowed
    | readonly CapabilityTag[]                   // AND — all must be allowed
    | { in: readonly CapabilityTag[] }           // OR — any must be allowed
    | { not: CapabilityTag };                    // NOT — must not be allowed
  gesturing?: boolean;
  actionIs?: string;
  modifierHeld?: keyof ModifierState;
  focused?: boolean;
  hovering?: boolean;
  hoveringSelected?: boolean;
  zoomAtLeast?: number;
  // additional keys as needed — each is paired with an atom in the fluent layer
}

// Composition nodes. `Rule` is recursive.
type Rule =
  | Selector
  | { all: readonly Rule[] }       // explicit conjunction (flattened on construction)
  | { any: readonly Rule[] }       // disjunction
  | { not: Rule }                  // negation
  | { when: (ctx: ChromeCtx) => boolean }; // inspectability escape hatch
```

Empty `all` evaluates to `true`; empty `any` evaluates to `false`. The evaluator short-circuits.

### Polarity is per-rule, not system-wide

Whitelist and blacklist forms are both first-class and compose with the rest of the grammar:

```ts
'path-edit.anchors':       { mode: 'path-edit' },                          // whitelist
'selection.outline':       { mode: { not: 'path-edit' } },                 // blacklist
'selection.scale-handles': { mode: { in: ['normal', 'isolation'] } },      // set whitelist
```

Per-rule choice; no global default-polarity knob. The resolution rule is fixed: an id with a rule is governed by its rule; an id without a rule resolves to `always` for backward compatibility with consumer-registered ids that pre-date the migration.

Style convention (not enforcement): prefer `mode: 'x'` or `mode: { in: [...] }` when the "active" set is small; prefer `mode: { not: 'x' }` only when the "inactive" set is a single mode. A `not` clause that grows to two or more modes is a smell — author should refactor to `in`. This is doc convention only; no lint required in v1.

### Fluent layer is sugar over the tree

The existing fluent API stays, but every atom desugars to a tree fragment:

```ts
selectionAtLeast(1)           // → { selection: { atLeast: 1 } }
modeIs('normal')              // → { mode: 'normal' }
gesturing                     // → { gesturing: true }

selectionAtLeast(1).andNot(gesturing)
// → { all: [{ selection: { atLeast: 1 } }, { not: { gesturing: true } }] }

focused.and(selectionAtLeast(1)).or(modeIs('debug'))
// → { any: [{ all: [{ focused: true }, { selection: { atLeast: 1 } }] }, { mode: 'debug' }] }
```

The builder flattens nested `all`/`all` and `any`/`any` at construction time so canonical form is automatic regardless of authoring style. Atoms are thin tree-fragment constructors. **The atom inventory IS the schema** — adding a new selector key requires adding both the tree-grammar entry and the fluent atom, in the same change.

`when((ctx) => boolean)` remains as an escape hatch for predicates that can't be expressed declaratively (e.g., view-math-heavy custom rules). Its use is discouraged; reach for `when` is a signal that the system is missing an atom, and the right reflex is to add the atom rather than embed an opaque closure. A debug panel that walks the tree explaining "why is this off" will mark `when` nodes as "opaque — provided by author."

### Unified context

The current `ChromeCtx` and `ChromeState` overlap in their `selection`/`modifiers` fields but exist in different files for historical reasons. The rule evaluator needs a single context shape that carries everything any selector might read:

```ts
interface RuleCtx {
  readonly mode: string;                                  // active mode id
  readonly modes: ModeRegistry;                           // for capability resolution
  readonly selection: readonly NodeId[];
  readonly multiActive: boolean;
  readonly modifiers: ModifierState;
  readonly action: { kind: string | null; id: string | null };
  readonly focused: boolean;
  readonly hover: NodeId | null;
  readonly view: View;
}
```

`ChromeCtx` becomes an alias / subset re-export of `RuleCtx`. `ChromeState` keeps its bounds-related members (`boundsOf`, `unionBounds`) since affordance math needs them; `RuleCtx` is the snapshot the rule evaluator consumes.

The `suppressedIds` field is removed in this pass. Its single producer (`getSuppressedSelectionIds` in `SceneCanvas.tsx`) and its single consumer (the selection-overlay layer's ad-hoc filter) both fold into the unified system — the overlay's `selection.outline` rule becomes `{ selection: { atLeast: 1 }, mode: { not: 'path-edit' } }` and the per-node "skip the editing id" logic dies.

### Same vocabulary for action eligibility

Actions gain an optional `eligible: Rule` field on the descriptor:

```ts
export const moveAction: Action = {
  id: 'move',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene'],
  invoker: { /* ... */ },
};

export const editAnchorsAction: Action = {
  id: 'editAnchors',
  defaultBinding: { kind: 'drag', target: { /* anchor predicate */ } },
  eligible: { capability: 'edits-anchors' },
  requires: ['selection', 'editAnchors'],
  invoker: { /* ... */ },
};

// Multi-capability AND — array form. Both must be allowed.
export const duplicateAction: Action = {
  id: 'duplicate',
  eligible: { capability: ['edits-page', 'creates-selection'] },
  /* ... */
};

// Always-on — omit `eligible` entirely.
export const undoAction: Action = {
  id: 'undo',
  defaultBinding: { kind: 'key', key: 'mod+z' },
  // no `eligible` field → always eligible
  /* ... */
};

// Entry actions — gated by source mode rather than capability.
// A user can enter path-edit by double-clicking a polygon while in
// `normal` mode OR while inside an `isolation` context.
export const enterPathEditAction: Action = {
  id: 'enterPathEdit',
  defaultBinding: { kind: 'doubleClick', target: { /* ... */ } },
  eligible: { mode: { in: ['normal', 'isolation'] } },
  /* ... */
};
```

**Selector semantics for capability and mode.** Both keys share the same shape for consistency:

| Form | Capability semantics | Mode semantics |
|---|---|---|
| `'x'` | exact match — must be allowed | exact match — must be active mode |
| `['x', 'y']` | AND — all must be allowed | rejected at construction (modes are exclusive) |
| `{ in: ['x', 'y'] }` | OR — any one must be allowed | OR — must be in the set |
| `{ not: 'x' }` | must NOT be allowed | must NOT be active mode |

Capability arrays are AND because actions typically *require* multiple capabilities simultaneously (duplicate needs both page-edit AND selection-write). Mode arrays would be ambiguous (an active mode is always exactly one value) so the array form is reserved for capability; mode uses `{ in: [...] }` for the "any of these modes" case. The evaluator rejects mode arrays at construction time to prevent confusion.

**Why capability over mode-id where it fits.** A new mode added later with the same capability automatically extends eligibility. Mode-id rules require remembering to add every new mode to a list. Prefer `capability:` whenever the constraint is genuinely "this action needs capability X." Use `mode:` for entry actions (gated by the *source* mode they invoke from) and for actions whose constraint really is mode-shape, not capability-shape.

The dispatcher's match-and-try loop gains one filter step between `matchSorted` and `start()`:

```
candidates = matchSorted(event, bindings, isMac, engagedChannels)
candidates = candidates.filter(c => evaluate(action(c).eligible ?? always, ruleCtx))
for candidate in candidates:
  handle = candidate.action.start(ctx, opts)
  if handle.kind: return handle
  // else fall through (existing behavior)
```

`eligible` is the declarative gate (fast, inspectable, mode-aware). `enabled()` stays for runtime checks that genuinely need imperative computation (dep presence checks, selection-shape checks). Both must pass.

### Capability vocabulary rename

The existing tag `'selection'` breaks the verb-noun pattern of the rest of the vocabulary (`creates-paths`, `creates-shapes`, `transforms-selection`, etc.) and is conceptually ambiguous (does an action "have selection" or "do something to selection"?). Rename to `'creates-selection'` for symmetry with `'transforms-selection'`:

- `'creates-selection'` — writes the selection set (select tool, areaSelect, lassoSelect, selectAll, clearSelection, shift-click-to-toggle, etc.)
- `'transforms-selection'` — operates on the existing selection set (move, resize, rotate, flip, align, distribute, nudge)
- Read-only consumers of selection (e.g., `delete` reads `selection.get()` to know what to delete) are tagged by what they *do* (`'edits-page'`), not by the fact that they read selection.

The vocabulary after rename:

```ts
export const ALL_TAGS = [
  'navigation',          // implicit always-on
  'creates-selection',   // was 'selection'
  'creates-paths',
  'creates-shapes',
  'creates-text',
  'edits-anchors',
  'edits-text',
  'transforms-selection',
  'samples-color',
  'applies-fill',
  'edits-page',
] as const;
```

`'navigation'` stays as-is despite breaking the verb-noun pattern: it's the implicit always-on tag and is rarely typed in mode definitions. Renaming churn for low gain.

### Action capability annotations — the full registry

The current 47 built-in actions categorize as follows. This is the canonical mapping for Phase 5.

**Always-on (omit `eligible`):**
- `undo`, `redo`, `escape`, `cancelGesture`
- `viewport.dragPan`, `viewport.pan`, `viewport.wheelPan`, `viewport.zoom`, `pinchZoom` *(could also tag as `'navigation'` — the implicit-tag mechanism gives the same result; prefer omission for "no constraint" intent)*

**`'creates-selection'`:**
- `selectAll`, `clearSelection`, `areaSelect`, `lassoSelect`

**`'transforms-selection'`:**
- `move`, `resize`, `rotate`, `flip`
- `nudgeUp`, `nudgeDown`, `nudgeLeft`, `nudgeRight` *(see "Nudge ambiguity" below)*
- `alignLeft`, `alignRight`, `alignTop`, `alignBottom`, `alignCenterX`, `alignCenterY`
- `distributeHorizontal`, `distributeVertical`

**`'edits-anchors'`:**
- `editAnchors`, `insertPathAnchor`

**`['edits-page', 'creates-selection']` (multi-cap AND):**
- `duplicate` (creates new node + selects it)
- `clone` (drag-clone semantics: places new node + selects it)

**`'edits-page'`:**
- `delete`, `group`, `ungroup`
- `reorderForward`, `reorderBackward`

**`'creates-shapes'`:**
- `insert`, `insertRotate`
- `pathfinderUnion`, `pathfinderSubtract`, `pathfinderIntersect`, `pathfinderExclude`, `pathfinderDivide`, `pathfinderCrop`

**`'applies-fill'`:**
- `setFill`, `setStroke`, `setFillOpacity`, `setStrokeOpacity`

**Entry actions (gated by source mode, not capability):**
- `enterPathEdit` — `eligible: { mode: { in: ['normal', 'isolation'] } }`
- `enterTextEdit` — `eligible: { mode: { in: ['normal', 'isolation'] } }`
- `exitPathEdit` — `eligible: { mode: 'path-edit' }` (only active *during* path-edit; clears the mode)

#### Nudge ambiguity

`nudgeUp/Down/Left/Right` translate selected *nodes* with `'transforms-selection'`. In path-edit mode the same arrow keys should translate selected *anchors* via the editAnchors machinery. **These are separate concerns and should be separate action descriptors** with the same key bindings — only one is eligible at a time, so no dispatch conflict:

```ts
nudgeUpAction:           { eligible: { capability: 'transforms-selection' }, /* ... */ }
nudgeAnchorUpAction:     { eligible: { capability: 'edits-anchors' }, /* ... */ }
```

If the current code path branches internally on mode for nudge, this spec calls for splitting it. The new system requires that each action's behavior is unambiguous given the mode — no hidden mode-dependent branching inside `start()`.



`eligibleForMode(mode, toolCapabilities)` returns true when the tool advertises any capability the mode allows. This pre-dates the rule system and works correctly today, but it's a separate path. To unify:

- Keep `ModeDefinition.allows: readonly CapabilityTag[]` as the source of truth for "what capabilities are live in this mode."
- The rule grammar gains a `capability:` selector that reads against the active mode: `{ capability: 'edits-anchors' }` is `true` when the active mode's `allows` includes `'edits-anchors'`.
- Tool eligibility *can* be re-expressed as a rule on each tool descriptor (`eligible: { capability: { in: tool.capabilities } }`), but it doesn't have to be — `eligibleForMode` continues to work as a specialized fast-path. The rule grammar simply gives tools the option to express more nuanced eligibility (e.g., a tool that's eligible only when path-edit AND a specific selection condition) without a separate API.

Action eligibility is recommended to use `capability:` rather than `mode:` directly:

```ts
moveAction: { eligible: { capability: 'transforms-selection' } }  // preferred
moveAction: { eligible: { mode: { not: 'path-edit' } } }          // also valid, less general
```

`capability:` reads the mode's allow-list, so adding a new mode with the same capability automatically extends the action's eligibility. Mode-id rules require remembering to add every new mode to the list. Prefer capability-based eligibility whenever the constraint is genuinely "this action needs capability X."

### Affordance pipeline as a chrome-caps consumer

`buildAffordanceAt` today walks `state.selection` and emits affordance kinds independent of chrome-caps. This is the source of the "selection chrome paints but isn't hittable" / "chrome doesn't paint but is still hittable" drift.

Change: the affordance pipeline receives the resolver `isVisible: (id: ChromeId) => boolean` and consults it before classifying any hit:

```ts
function affordanceAt({ x, y }): AffordanceHit | null {
  // Corner resize handles — only if 'selection.resize-handles' is active
  if (isVisible('selection.resize-handles')) {
    const target = pickResizeTarget(state);
    if (target) {
      for (const c of cornersFor(target.bounds)) {
        if (dist2(x, y, c.worldX, c.worldY) <= r2) {
          return { kind: c.kind, /* ... */ };
        }
      }
    }
  }
  // Rotation handle — gated similarly
  if (isVisible('selection.rotation-handle')) { /* ... */ }
  // Anchor + control handles — gated by 'path-edit.anchors'
  if (isVisible('path-edit.anchors') && getAnchorState) { /* ... */ }
  return null;
}
```

This makes the invariant in `chrome-caps/types.ts:67` (*"the same id gates both paint and hit-test"*) literally enforced, not a convention. There is one resolver, one tree, one answer.

### Evaluator

The evaluator is a recursive interpreter over the tree:

```ts
function evaluate(rule: Rule, ctx: RuleCtx): boolean {
  if ('all' in rule) return rule.all.every(r => evaluate(r, ctx));
  if ('any' in rule) return rule.any.some(r => evaluate(r, ctx));
  if ('not' in rule) return !evaluate(rule.not, ctx);
  if ('when' in rule) return rule.when(ctx);
  return evaluateSelector(rule, ctx);
}

function evaluateSelector(s: Selector, ctx: RuleCtx): boolean {
  if (s.selection !== undefined && !checkSelection(s.selection, ctx)) return false;
  if (s.mode !== undefined && !checkMode(s.mode, ctx)) return false;
  if (s.capability !== undefined && !checkCapability(s.capability, ctx)) return false;
  if (s.gesturing !== undefined && (ctx.action.kind !== null) !== s.gesturing) return false;
  // ... one branch per selector key, AND'd
  return true;
}
```

Short-circuits naturally. No memoization in v1; profile before adding. Tests are direct — feed a rule and a ctx, assert the boolean.

### Named target predicates

Action `defaultBinding.target.kindOf` closures are repetitive and obscure intent today. Compare:

```ts
target: {
  kindOf: (_, bodyTarget) =>
    bodyTarget === 'selected-body' || bodyTarget === 'unselected-body',
},
```

vs.

```ts
target: { kindOf: isBody },
```

Extract a small predicate library at `src/interactions/dispatcher/predicates.ts` covering the existing patterns. Each predicate matches the existing `kindOf` signature `(target: unknown, bodyTarget?: string) => boolean` — no wrapper layer, just named functions that drop into `target.kindOf` directly. The library is the dictionary: new predicate types get added once with a name, every action that needs the same shape pulls from the same source.

Initial set, covering today's call sites:

```ts
// Body-class predicates (read the second arg)
isBody              // selected OR unselected body
isSelectedBody      // selected-body only
isUnselectedBody    // unselected-body only
isEmpty             // empty-canvas hit

// Affordance-kind predicates (read the first arg)
isResizeHandle      // handle:top-left/etc.
isRotateHandle      // rotate-handle
isAnchor            // anchor:N
isControlHandle     // controlIn:N or controlOut:N
isAnchorOrControl   // any of the three anchor-editing affordances
```

A grep audit before extraction will surface anything else worth a name (rough estimate: 8-12 unique closure shapes across the 47 actions). Anything used exactly once stays inline; anything used twice or more gets named.

Located in the dispatcher tree rather than the actions tree because these are dispatcher-side primitives — they describe how the dispatcher classifies hits, not how individual actions consume them. Putting them next to `matcher.ts` and `dispatcher.ts` makes the conceptual neighborhood clear.

## Migration

The migration is incremental and mechanical because the fluent layer keeps working unchanged.

**Phase 1 — Grammar and evaluator.** Define `Rule`, write the evaluator, write `RuleCtx`. Add tests. No consumer changes yet.

**Phase 2 — Fluent layer compiles to tree.** Change every atom in `conditions.ts` to construct a tree fragment instead of a closure. `cond()` becomes internal — the public API is the atom set + combinators. Tests for chrome-caps continue passing because the public surface is identical.

**Phase 3 — Migrate `defaults.ts`.** Rewrite each rule in literal-tree form, adding mode constraints. This is where the bug fix lands:

```ts
'selection.outline':         { selection: { atLeast: 1 }, mode: { not: 'path-edit' } },
'selection.resize-handles':  { selection: { atLeast: 1 }, gesturing: false, mode: { not: 'path-edit' } },
'selection.rotation-handle': { selection: { atLeast: 1 }, focused: true, gesturing: false, mode: { not: 'path-edit' } },
'path-edit.anchors':         { mode: 'path-edit' },
'path-edit.overlay':         { mode: 'path-edit' },
```

`suppressedIds` is removed from `ChromeCtx` and the surrounding plumbing in `SceneCanvas.tsx`. Selection-overlay's ad-hoc `getSuppressedSelectionIds` filter is dropped — the chrome-caps gate is now load-bearing for the outline rule too.

**Phase 4 — Affordance pipeline consumes the resolver.** `buildAffordanceAt` accepts `isVisible` and gates each affordance branch. The bug is fixed at this point: resize/rotate cannot fire in path-edit because their chrome ids resolve to false, so the affordance pipeline can't classify a hit as `handle:top-left`.

**Phase 5 — Action eligibility on built-ins, plus predicate extraction.** Annotate all 47 built-in actions per the canonical mapping in "Action capability annotations" above. Rename `'selection'` capability tag to `'creates-selection'` across the kit (capabilities.ts, every tool/action declaration, every mode allows-list, tests). Split the nudge action family into node-nudge and anchor-nudge descriptors. Extract `src/interactions/dispatcher/predicates.ts` with the named target predicates from the "Named target predicates" section above, and replace every inline `kindOf` closure that has a match in the library with the named helper. Inline-once predicates stay inline. Dispatcher's `matchSorted` loop adds the eligibility filter:

```ts
candidates = matchSorted(event, bindings, isMac, engagedChannels)
candidates = candidates.filter(c => evaluate(action(c).eligible ?? always, ruleCtx))
for candidate in candidates:
  handle = candidate.action.start(ctx, opts)
  if handle.kind: return handle
```

This closes the remaining mode-leak: even hypothetical bindings that match (e.g., a future affordance bug) wouldn't dispatch the wrong action because the action itself declines. Belt-and-suspenders with the chrome-caps gate from Phases 3-4.

Each phase is independently testable and committable. Phases 1–2 are pure groundwork (no behavior change). Phase 3 ships the visual + render-side fix. Phase 4 ships the hit-test fix. Phase 5 ships the dispatcher-side belt to the chrome-side suspenders.

## What this does not address

- **Per-node chrome rules.** Some chrome is per-node-conditional ("show resize handles for selected nodes, not for the editing node specifically"). The current grammar handles this through the `selection` selector but doesn't let a rule say "active for nodes IN this set." If that need arises, the grammar can be extended with a `selector` that takes a node id (`{ selectedAnd: (id) => boolean }`); v1 doesn't include this because no current rule needs it.
- **Mode-scoped action binding overrides.** A mode can't currently *remap* an action's binding (e.g., "in path-edit mode, Backspace deletes the selected anchor, not the selected node"). The dispatcher's scope ordering and tool-vs-ambient binding model handles most cases. When a mode genuinely needs to remap, the action gets duplicated — one for each binding, each with appropriate `eligible:` (this is what the nudge split does). Acceptable for now.
- **Path-edit anchor-drag bug fix is downstream.** This spec is the foundation. The actual bug fix (resize firing on anchor drag) lands in Phase 3 + Phase 4, not as a separate change.
- **`applyEdit`'s `invert`-less op.** Separate bug in `src/canvas/deps/editAnchors.ts:158-192` — the undo correctness issue I found earlier. Out of scope here; this spec is about the dispatch/chrome architecture. Will be addressed in a separate fix.
- **Cursor-style unification.** Today each tool sets cursor imperatively via a `cursor: (ctx) => string` callback. The dispatch system computes "what binding would fire at this point" on every pointer move, which is exactly what cursor needs — the cursor should reflect the action that would fire. Natural follow-up: a `cursor` field on Action descriptors, with the dispatcher reading it from the top eligible binding at the cursor's current position. Deferred to a separate spec because (a) the migration is meaningful (every tool's cursor callback gets redistributed across actions), (b) cursor closures aren't tree-inspectable and warrant their own design (declarative table per affordance kind vs. per-action closures), and (c) this bug doesn't need cursor unification to be fixed. Best landed once Phases 1-5 stabilize the dispatcher's "what would fire" data path. Hover state and hover-driven chrome are *already* expressible via the rule grammar (`hovering` / `hoveringSelected` atoms exist in `conditions.ts` today and survive the migration) — only cursor needs a follow-up pass.

## Risks

- **Migration touches a lot of test surface.** chrome-caps tests, dispatcher tests, affordance tests, action descriptor tests. Manageable because the public APIs (atom names, combinator semantics) don't change in phases 1–2.
- **The `when` escape hatch.** If consumers reach for `when` casually, we lose inspectability for those rules. Mitigation is doc + dev-panel UX that marks `when` nodes visibly. Not enforced.
- **The "absent → always" backward compat default.** Consumers who registered custom chrome ids without rules get default-on behavior, which is fine. But it means a consumer who *expected* "no rule = no chrome" gets surprised. Migration note in CHANGELOG.
- **`capability:` reads the mode registry.** If a mode is added/removed dynamically, eligibility re-evaluates. This is desired but worth flagging — actions can become eligible/ineligible mid-session as modes change. Modes are static today (kit-default + apps/draw additions at startup), so this is theoretical.
- **Affordance becoming a chrome-caps consumer creates a runtime dependency** affordance never had before. If `isVisible` is slow, it's now on the hot path of every pointer move. Trees are O(depth); should be fine, but measure once.

## What "stable dispatch" looks like after this

The dispatcher's job becomes:

1. Synthesize input event from raw pointer / key events. *(unchanged)*
2. Classify the world point via `affordanceAt` — which now consults the rule evaluator before claiming an affordance kind exists.
3. `matchSorted` finds candidate bindings by structural specificity. *(unchanged)*
4. Filter candidates by `eligible` rule evaluation against the current `RuleCtx`.
5. Try candidates in order; first one whose `start()` returns a non-empty handle wins.

Adding a new mode is then: declare it in the mode registry, add chrome rules for whatever id-prefix the mode owns, annotate the actions that should be eligible. No code in the dispatcher changes; no consumer code that doesn't own the mode changes. The dispatcher is a generic mechanism whose behavior is determined entirely by the tables it reads.

That's the property — "give it proper directions and it works" — concretized as: the tables are the directions, and there are exactly three of them (mode definitions, chrome rules, action descriptors with eligibility).
