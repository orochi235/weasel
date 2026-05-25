# chrome-caps — design

Date: 2026-05-24
Status: design, ready to implement.

## Goal

Declarative visibility rules for overlay chrome (selection handles,
rotation handle, marquee, snap guides, etc.). Today the chrome's
"when to show" logic is inlined inside affordance `regions()` methods
and overlay-layer `draw()` early-returns. Lift those into a single
declared rules table that gates both paint and hit-test from one id,
guaranteeing visible-is-hittable.

## Vocabulary

- **Chrome id** — stable identifier for one user-visible chrome
  element (`selection.resize-handles`, `gesture.marquee`, …).
- **Condition** — `(ctx: ChromeCtx) => boolean`, composable via a
  fluent `cond()` builder.
- **`ChromeCtx`** — the live state conditions read from.
- **`VisibilityRules`** — `Partial<Record<ChromeId, Condition>>`,
  merged on top of the kit's defaults.

## Surface

```ts
// types.ts
type ChromeCtx = {
  focused: boolean
  selection: readonly NodeId[]
  multiActive: boolean
  suppressedIds: ReadonlySet<string>
  modifiers: ModifierState
  gesture: { kind: string | null; id: string | null }
  hover: NodeId | null
  view: View
}

interface Condition {
  (ctx: ChromeCtx): boolean
  and(other: Condition): Condition
  or(other: Condition): Condition
  andNot(other: Condition): Condition
  orNot(other: Condition): Condition
}

type ChromeId =
  | 'selection.outline'
  | 'selection.resize-handles'
  | 'selection.rotation-handle'
  | 'gesture.marquee'
  | 'gesture.move-ghosts'
  | 'snap.guides'
  | 'grid'
  | (string & {})  // extensible

type VisibilityRules = Partial<Record<ChromeId, Condition>>
```

Fluent builder:

```ts
const focused                = cond(c => c.focused)
const gesturing              = cond(c => c.gesture.kind !== null)
const gestureIs   = (k:string) => cond(c => c.gesture.kind === k)
const selectionIs = (n:number) => cond(c => c.selection.length === n)
const selectionAtLeast = (n:number) => cond(c => c.selection.length >= n)
const hovering               = cond(c => c.hover !== null)
const modifierHeld = (m:keyof ModifierState) => cond(c => c.modifiers[m])
```

**Chain semantics: strict left-to-right.** No precedence. Mixed
`.and`/`.or` chains evaluate in declaration order. Documented; not
"fixed" via parser tricks. (Decision earlier in design discussion.)

Defaults:

```ts
const defaultVisibilityRules: VisibilityRules = {
  'selection.outline':         selectionAtLeast(1),
  'selection.resize-handles':  selectionIs(1).andNot(gesturing),
  'selection.rotation-handle': selectionIs(1).and(focused).andNot(gesturing),
  'gesture.marquee':           gestureIs('marquee'),
  'gesture.move-ghosts':       gestureIs('move'),
  'snap.guides':               gesturing,
}
```

Consumer override:

```tsx
<SceneCanvas
  scene={scene}
  chromeVisibility={{
    'selection.rotation-handle': selectionIs(1).and(focused).andNot(gesturing),
    'snap.guides': never,
  }}
/>
```

## Resolver

```ts
function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ctx: ChromeCtx,
): (id: ChromeId) => boolean {
  const merged = { ...defaultVisibilityRules, ...consumer }
  return id => (merged[id] ?? always)(ctx)
}
```

One resolver per frame; predicates run hot but are O(1).

## Integration sites

Per the chrome-caps survey:

1. **`src/affordances/composeAffordanceLayer.ts`** — paint loop
   (lines 54–62) and hit-test loop (69–77) both iterate `affordances`.
   Filter by `isVisible(a.id as ChromeId)` before calling `a.regions(state)`.
2. **`src/affordances/cornerResize.ts:92`** — delete inline
   `if (state.selection.length === 1)`. Affordance just emits regions;
   the rule table gates.
3. **`src/affordances/rotationHandle.ts:155`** — same.
4. **`src/features/selection/overlay.ts:630–673`** — early returns at
   646, 652 and the `getSuppressedIds()` reads become rule lookups for
   `selection.outline` / `selection.resize-handles` /
   `selection.rotation-handle`. `suppressedIds` becomes a `ChromeCtx`
   field; per-id suppression can still be expressed as
   `not(suppressed('selection.rotation-handle'))` in a consumer rule.
5. **`<SceneCanvas>` prop** — add `chromeVisibility?: VisibilityRules`
   to `SceneCanvasProps`, thread to both integration sites above.

## New state plumbing

- **`ChromeCtx.gesture`.** Dispatcher doesn't expose an active-gesture
  getter today. Add a small `getActiveGesture(): { kind, id } | null`
  on the dispatcher's public surface, then read live each frame.
- **`ChromeCtx.hover`.** No hover state today. Track last-hovered
  `NodeId` on pointer-move in the dispatcher (cheap — `getNodeAtPoint`
  already runs), expose via getter.
- **`ChromeCtx.focused`.** `useCanvasFocus().getFocused()` is the live
  source.
- **`ChromeCtx.suppressedIds`.** Already plumbed via
  `opts.getSuppressedIds?.()`; lift into context.
- **`ChromeCtx.selection` / `multiActive` / `modifiers`.** Already on
  `ChromeState`; ctx widens around it.

## Non-goals

1. **No parser / mini-DSL.** Plain functions only; full TS types,
   debuggable, breakpoint-friendly.
2. **No memoization in v1.** Predicates are trivial; profile before
   adding caching.
3. **No `NodeAffordances` trait yet.** chrome-caps lands against
   today's globally-added affordances. The next spec wires
   per-kind contributions via the trait, and chrome-caps reads from
   that without changing.
4. **No precedence "fixes" for mixed chains.** Strict left-to-right;
   documented in conditions.ts JSDoc.

## Migration

Phase 1 — module:
1. Create `src/features/chrome-caps/{types,conditions,defaults,resolve,index}.ts`.
2. Tests: atoms, fluent chaining, defaults table snapshot.

Phase 2 — state plumbing:
3. Add `getActiveGesture` getter to dispatcher.
4. Add hover tracking + getter to dispatcher.
5. Widen `ChromeState` consumers to build `ChromeCtx` (or add
   `ChromeCtx` alongside `ChromeState` — decide during impl).

Phase 3 — wire integration sites:
6. `composeAffordanceLayer` filters by id.
7. `createSelectionOverlayLayer` reads rules instead of inline checks.
8. Delete inline `selection.length === 1` from cornerResize.ts /
   rotationHandle.ts.
9. Add `chromeVisibility` prop to `<SceneCanvas>` and thread.

Phase 4 — verification:
10. `tsc --noEmit && vitest run && tsup build`.
11. Smoke test that overriding a rule actually hides the chrome
    (turn off `selection.rotation-handle`, assert it doesn't paint
    AND isn't hittable).

## Future work

- **`NodeAffordances` trait.** Per-kind affordance contributions
  replace today's globally-added `cornerResize` + `rotationHandle`.
  chrome-caps continues gating by id; the *what* moves per-kind, the
  *when* stays in the rules table.
- **Memoization** if profiling shows hot-path cost.
- **Additional context fields** as new rules demand them (e.g. drag
  origin, time-since-gesture-end).
