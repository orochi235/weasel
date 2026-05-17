# Registry unification — design

Date: 2026-05-16
Status: design, awaiting plan.

Source: `docs/TODO.md` "Taxonomy alignment" item 2.4 ("Action vs gesture
taxonomy is implementation-coupled") and the conversation in this session
that resolved Q1–Q4 plus design questions A–C (runtime contract of an
ongoing invoker, ambient-tool restructure, migration strategy).

The first three items of the taxonomy-alignment work shipped on branches
`taxonomy-alignment-interactions-reorg` and
`taxonomy-alignment-drag-events-consolidation`. This spec covers the
remaining item.

## Goal

Make the action registry the single place every state-changing user
operation lives, regardless of how it's invoked. Today the registry
holds one-shot actions (`delete`, `align.left`, `pathfinder.union`) and
drag-based operations (`move`, `resize`, `rotate`, `areaSelect`,
`insert`, `clone`, `lassoSelect`, `editAnchors`) live in separate
gesture hooks with their own dispatch surface. The split is
implementation-coupled (drag-phase present vs. not) rather than
user-intent-coupled, and it leaks: two parallel binding systems, two
parallel discoverability stories, no single answer to "what does this
gesture do." `docs/taxonomy.md:201–226` describes the realignment
target; this spec lands it in code.

End state: one registry, one binding surface (`GestureSpec`, with
keystroke as one variant alongside wheel, click, drag, multi-touch),
one `Action` shape with a discriminated `Invoker` for `immediate` vs
`ongoing` timing. Tools become palette-bound binding bundles that
declare which actions are reachable while they're active.

## Non-goals

- **Op infrastructure changes.** Ops stay where they are
  (`src/core/ops/`). The registry sits above ops; it produces op
  batches via existing `applyBatch`. No new op shapes, no signature
  changes on existing op factories.
- **Behavior interface redesign.** `ActionBehavior` and the per-action
  aliases (`MoveBehavior`, `ResizeBehavior`, …) stay as-is. Only their
  *attachment point* moves (from hook arg to Tool binding config).
- **Selection or Scene context redesign.** They stay in their current
  shape (`SelectionContext` already exists `@experimental`; Scene state
  is provided ambient via `<SceneCanvas>`).
- **Tool palette UI.** This spec defines the data shape; consumers
  render the palette however they like (Swill's `<ToolPalette>` etc.
  unchanged in surface, only in what data it reads).
- **Backwards compatibility shims.** Pre-1.0, single primary consumer
  (Swill). Big-bang end state; legacy hook surfaces (`useMove`,
  `useResize`, …) are deleted in the final phase.
- **Wheel/multi-touch binding to *immediate* actions only.** Pinch-zoom
  is a real `ongoing` action under this design, not a special-cased
  primitive.

## Background — what's drifting today

`docs/taxonomy.md:187–243` already states the target taxonomy:

> **Gesture** = the *form* of user input (drag-rect, click, keystroke,
> lasso). **Action** = a user-intent operation that modifies app state.
> The composition is an **Interaction**.

Today's implementation mismatches:

1. **Registry coverage is keystroke-only.** `Action.defaultBinding` is
   a key spec. Wheel-events, multi-touch gestures, drag-on-target, and
   click are not registry-reachable bindings. So features built on those
   inputs live outside the registry (and outside the command palette,
   keybinding map, and conflict detection).

2. **Drag-based ops aren't registered as actions.** `move`, `resize`,
   `rotate`, `areaSelect`, `insert`, `clone`, `lassoSelect`,
   `editAnchors` are hook-shaped (`useMove`, `useResize`, …). Tools
   compose them by calling the hooks. The registry knows nothing about
   them. Discoverability of "what does drag-on-X do" requires reading
   tool source.

3. **Ambient "tools" are scaffolding.** `useWheelPanTool`,
   `useWheelZoomTool`, `useKeyboardZoomTool`, `usePinchZoomTool`,
   `useNudgeTool`, `useDeleteTool`, `useDuplicateTool`,
   `useUndoRedoTool` exist because the only way to register
   keydown/wheel handlers today is via the tool-slot system. They're
   tools by accident of the registration surface, not by intent — none
   appear in the tool palette.

4. **Two parallel dispatch surfaces.** The action registry dispatches
   on keystroke via `useKeybinding`. The tool dispatcher (per
   `2026-05-12-declarative-tool-routing-design.md`) dispatches on
   pointer/wheel/keydown via per-tool slot tables. Same input class
   (e.g. a keydown), two paths.

The cleanup is: collapse all dispatch into one registry with a
gesture-spec binding surface; tools become passive binding bundles
scoped by an active-tool context.

## Design decisions (Q&A resolved in session)

### Q1 — shape of "drag-based action in the registry"

**Decision: variant (d) — Action descriptor with pluggable Invoker.**

```ts
type Action = {
  id: string
  label: string
  defaultBinding?: GestureSpec
  enabled?: (deps: ActionDeps) => boolean
  invoker: Invoker
  presentation?: { icon?: string; group?: string }
}

type Invoker =
  | { timing: 'immediate'; run(deps: ActionDeps): void }
  | { timing: 'ongoing'; start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle }
```

Discriminator field is `timing`; variants are `immediate` and
`ongoing`. New invocation kinds (long-press, modal-dialog, two-stage)
extend `Invoker` without widening `Action`.

**Interim shape during the transition.** The `Action` shape above is the
*end state* after Phase 9. During Phases 1–8 the legacy `defaultBinding?:
KeyBinding` field stays put (the existing `useKeybinding` machinery reads
it), and the new `gestureBinding?: GestureSpec` field is added alongside.
Phase 9 deletes the legacy field and renames `gestureBinding` →
`defaultBinding`. Two parallel fields during the transition keeps every
existing consumer that narrows `defaultBinding as KeyBinding` working
without per-callsite type guards. See Phase 1's plan for the original
widening attempt that surfaced this constraint.

Rejected: (a) tagged-union directly on `Action` (Action's own type
grows); (b) two parallel registries (notional unification); (c)
register-the-commit-only (doesn't solve discoverability).

### Q2 — Tool vs. Action after unification

**Decision: a tool's defining characteristic is a palette entry.**

A `Tool` is a palette-bound bundle of gesture-bindings. Tool selection
puts an id into `ActiveToolContext.active`; the dispatcher reads that
to know which tool's bindings are in scope.

Things that today are "tools" but don't belong in the palette
(`useWheelPanTool`, `useColorContextTool`, etc.) stop being tools — see
§ "Ambient restructure" below.

```ts
type Tool = {
  id: string
  label: string
  icon?: string
  group?: string
  bindings: GestureBinding[]
  cursor?: string | ((ctx: ToolCtx) => string)
  overlay?: RenderLayer
}

type GestureBinding = {
  spec: GestureSpec
  actionId: string
  opts?: BindingOpts
}
```

### Q3 — where Behaviors attach

**Decision: Behaviors live on the Tool's `GestureBinding.opts`;
dispatcher passes them through to `invoker.start(ctx, opts)`.**

```ts
defineTool({
  id: 'select',
  bindings: [
    { spec: { kind: 'drag', target: 'selected-body' },
      actionId: 'move',
      opts: { behaviors: [snapToGrid] } },
    { spec: { kind: 'drag', target: 'corner-handle' },
      actionId: 'resize',
      opts: { behaviors: [lockAspectWithModifier({ key: 'shift' })] } },
  ]
})
```

Actions register with their phase machine only; behaviors are
caller-policy. The same action invoked by two different tools genuinely
has different behavior chains. Command-palette entries for ongoing
actions show no behavior list (behaviors are configuration, not
identity).

### Q4 — enabled-state unification

**Decision: both timings get optional `enabled?(deps)`. Hit-test
remains the per-press authoritative gate for ongoing actions.**

Palette renders both kinds; `immediate` entries are click-invokable,
`ongoing` entries are informational (palette row shows the gesture
binding as hint text), with disabled state matching `enabled()`. Click
on an ongoing entry is a no-op.

### A — runtime contract of an ongoing Invoker

**Decision: `invoker.start(ctx, opts)` returns an `OngoingHandle` the
dispatcher pumps.**

```ts
type OngoingHandle = {
  onMove?(ctx: InvocationCtx): void
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void
}

type InvocationCtx = {
  world: { x: number; y: number }
  screen: { x: number; y: number }
  modifiers: ModifierState
  deps: ActionDeps
  // gesture-specific fields filled by the dispatcher per GestureSpec kind:
  drag?: { start: Point; current: Point; delta: Point }
  wheel?: { deltaX: number; deltaY: number; deltaZ: number }
  multiTouch?: { centroid: Point; spread: number; rotation: number }
  key?: { key: string; repeat: boolean }
}
```

The dispatcher owns the phase machine: pointerdown matches a binding's
GestureSpec → calls `start(ctx, opts)` → captures the returned handle
→ pumps `onMove` on each subsequent pointermove → calls
`onEnd(ctx, 'commit' | 'cancel')` on pointerup/pointercancel.

For `immediate` actions there's no handle — `invoker.run(deps)` is
called once and the dispatcher moves on.

`ActionDeps` is action-defined: actions declare which contexts they
consume (selection, view, scene, custom) and the dispatcher composes
them. This avoids one large god-Deps shape.

### B — ambient restructure

**Decision: option (3). Restructure entirely.**

Each former ambient "tool" decomposes into:

| Today | After |
|---|---|
| `useWheelPanTool` | Ambient gesture-bindings on `viewport.pan` |
| `useWheelZoomTool` | Ambient gesture-bindings on `viewport.zoom` |
| `useKeyboardZoomTool` | Ambient key-bindings on `viewport.zoom` |
| `usePinchZoomTool` | Ambient gesture-binding (`{kind: 'multiTouch', fingers: 2}`) on a new `viewport.pinchZoom` ongoing action |
| `useNudgeTool` | The `nudge` immediate action; ambient key-bindings populate its `defaultBinding` |
| `useDeleteTool` | Same — `delete` action |
| `useDuplicateTool` | Same — `duplicate` action |
| `useUndoRedoTool` | Same — `undo` and `redo` actions |
| `useColorContextTool` (Swill) | `<ColorContextProvider>` + immediate actions (`color.reset`, `color.swap`, `color.toggleFocusedNone`) |

"Ambient gesture-binding" is a top-level concept: a binding registered
without a parent tool, always in scope.

### C — migration strategy

**Decision: plan as big-bang (single end state, no compat shims),
execute as phased commits within one branch.** See § "Phased plan"
below.

## Types — full surface

```ts
// ──────────────────────────────────────────────────────────────
// Gesture specs — every kind of user input the dispatcher matches.
// ──────────────────────────────────────────────────────────────
type GestureSpec =
  | KeySpec
  | KeyHeldSpec
  | WheelSpec
  | ClickSpec
  | DragSpec
  | MultiTouchSpec

type KeySpec       = { kind: 'key'; key: string; mods?: ModSpec }
type KeyHeldSpec   = { kind: 'key-held'; key: string; mods?: ModSpec }
type WheelSpec     = { kind: 'wheel'; mods?: ModSpec }
type ClickSpec     = { kind: 'click'; target?: TargetSpec; mods?: ModSpec }
type DragSpec      = { kind: 'drag'; target?: TargetSpec; mods?: ModSpec }
type MultiTouchSpec = { kind: 'multiTouch'; fingers: number; mods?: ModSpec }

type ModSpec = Partial<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }>

// TargetSpec uses the kit-owned object-kind registry from
// `docs/TODO.md` Tier 1 ("Kit-owned object-kind registry") plus
// affordance kinds emitted by the affordance pipeline:
type TargetSpec =
  | 'empty'                  // pointerdown on canvas background
  | 'selected-body'          // any selected node's body
  | 'unselected-body'        // any unselected node's body
  | `kind:${string}`         // by node kind (e.g. 'kind:rect', 'kind:text')
  | `kind:${string}:selected`
  | `affordance:${string}`   // e.g. 'affordance:handle:bottom-right', 'affordance:anchor:first'
  | { kindOf: (target: HitResult) => boolean }  // custom predicate escape hatch

// ──────────────────────────────────────────────────────────────
// Actions — registered with the kit; both timings supported.
// ──────────────────────────────────────────────────────────────
type Action = {
  id: string
  label: string
  defaultBinding?: GestureSpec
  enabled?: (deps: ActionDeps) => boolean
  invoker: Invoker
  presentation?: { icon?: string; group?: string }
}

type Invoker =
  | { timing: 'immediate'; run(deps: ActionDeps): void }
  | { timing: 'ongoing'; start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle }

type OngoingHandle = {
  onMove?(ctx: InvocationCtx): void
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void
}

type BindingOpts = {
  behaviors?: ActionBehavior<any, any, any>[]
  // future: snap, custom params, etc.
}

// ActionDeps is action-defined. Convention:
type ActionDeps = {
  selection?: SelectionApi
  view?: ViewportApi
  scene?: SceneApi
  pointer?: PointerApi
  activeTool?: ActiveToolApi
  // consumer-side contexts (e.g. ColorContext) plug in by adapter
  [k: string]: unknown
}

// ──────────────────────────────────────────────────────────────
// Tools — palette-bound binding bundles.
// ──────────────────────────────────────────────────────────────
type Tool = {
  id: string
  label: string
  icon?: string
  group?: string
  bindings: GestureBinding[]
  cursor?: string | ((ctx: ToolCtx) => string)
  overlay?: RenderLayer
}

type GestureBinding = {
  spec: GestureSpec
  actionId: string
  opts?: BindingOpts
}

// ──────────────────────────────────────────────────────────────
// ActiveToolContext — runtime selection state for tools.
// ──────────────────────────────────────────────────────────────
type ActiveToolContextValue = {
  active: string
  hotkeyStack: string[]
  setActive(id: string): void
  pushHotkey(id: string): void
  popHotkey(): void
}
```

## Dispatcher contract

The dispatcher receives raw input events (pointer*, keydown/keyup,
wheel, touch) and routes them to actions via gesture-binding matching.

```
on input event e:
  // 1. Collect bindings currently in scope.
  tool = registry.tools.get(activeToolCtx.active)
  hotkeyTools = activeToolCtx.hotkeyStack.map(id => registry.tools.get(id))
  inScope = [
    ...ambientBindings,                            // global, always present
    ...tool.bindings,                              // active tool's bindings
    ...hotkeyTools.flatMap(t => t.bindings),       // held-hotkey bindings (top of stack last)
  ]

  // 2. Match e against in-scope bindings. Precedence: hotkey > active > ambient.
  binding = matchBest(e, inScope)
  if (!binding) return

  // 3. Look up action; check enabled().
  action = registry.actions.get(binding.actionId)
  if (action.enabled && !action.enabled(deps)) return

  // 4. Invoke per invoker timing.
  if (action.invoker.timing === 'immediate') {
    action.invoker.run(deps)
  } else {
    handle = action.invoker.start(buildCtx(e), binding.opts)
    dispatcher.capturePhase(e, handle)  // pumps onMove until commit/cancel
  }
```

Phase-pumping for ongoing actions:
- pointerdown → `start(ctx, opts)`; capture handle and pointer.
- pointermove → `handle.onMove(ctx)` per event (subject to existing
  throttle/coalesce).
- pointerup → `handle.onEnd(ctx, 'commit')`; release.
- pointercancel / window blur / escape → `handle.onEnd(ctx, 'cancel')`;
  release.
- key-held (for key-held GestureSpecs): keydown → start; keyup →
  `onEnd(ctx, 'commit')`.

`matchBest` precedence within a single scope is by specificity (target
'selected-body' beats 'empty' when both could match; mods present beats
mods absent). Across scopes: hotkey > active > ambient. Reuses existing
precedence logic from `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`
where applicable.

## Action catalog after migration

### Immediate actions (existing + populated `defaultBinding`)

| Action id | Default binding | Source |
|---|---|---|
| `selectAll` | `{ kind: 'key', key: 'a', mods: { meta: true } }` | existing |
| `escape` | `{ kind: 'key', key: 'Escape' }` | existing |
| `delete` | `{ kind: 'key', key: 'Backspace' }` | existing (was `useDeleteTool`) |
| `duplicate` | `{ kind: 'key', key: 'd', mods: { meta: true } }` | existing (was `useDuplicateTool`) |
| `nudge.{up,down,left,right}[.big]` | arrow keys | existing (was `useNudgeTool`) |
| `undo` / `redo` | `{ kind: 'key', key: 'z', mods: { meta: true } }` / shift-z | existing (was `useUndoRedoTool`) |
| `align.{left,right,top,bottom,centerX,centerY}` | none by default | existing |
| `distribute.{horizontal,vertical}` | none | existing |
| `flip.{x,y}` | `{ kind: 'key', key: 'h', mods: { shift: true } }` / shift-v | existing |
| `reorder.{bringForward,sendBackward,bringToFront,sendToBack}` | none | existing |
| `group` / `ungroup` | meta-g / shift-meta-g | existing |
| `nest` / `unnest` | none | existing |
| `clipboard.{cut,copy,paste}` | meta-x/c/v | existing |
| `pathfinder.{union,subtract,intersect,exclude,divide,crop}` | none | existing |
| `viewport.zoom` | parametric (factor, center) — bound multiple ways | new |
| `viewport.pan` | parametric (delta) — bound multiple ways | new |
| `viewport.fit` | meta-0 | existing |
| `viewport.reset` | meta-1 | existing |
| `tool.activate:<id>` (one per tool) | the tool's `presentation.shortcut` | new — replaces tool-slot keybinding mechanics |

### Ongoing actions (drag-based hooks promoted)

| Action id | Was | Default binding |
|---|---|---|
| `move` | `useMove` | none (tool-bound) |
| `resize` | `useResize` | none (tool-bound) |
| `rotate` | `useRotate` | none (tool-bound) |
| `areaSelect` | `useAreaSelect` | none (tool-bound) |
| `lassoSelect` | `useLassoSelect` | none (tool-bound) |
| `insert` | `useInsert` (drag-rect insert) | none (tool-bound) |
| `clone` | `useClone` | none (tool-bound) |
| `editAnchors` | `useEditAnchors` | none (tool-bound) |
| `viewport.pinchZoom` | `usePinchZoomTool` | `{ kind: 'multiTouch', fingers: 2 }` (ambient) |
| `tool.hold:hand` | hotkey-slot space-for-hand | `{ kind: 'key-held', key: ' ' }` (ambient) |

### Ambient gesture-bindings (no parent tool)

| Action | GestureSpec |
|---|---|
| `viewport.zoom` | `{ kind: 'wheel', mods: { ctrl: true } }` (and parametric variants for keyboard +/−/0) |
| `viewport.pan` | `{ kind: 'wheel' }` |
| `viewport.pinchZoom` | `{ kind: 'multiTouch', fingers: 2 }` |
| `undo` / `redo` / `delete` / `duplicate` / `nudge.*` / `selectAll` / `escape` / `clipboard.*` / `flip.*` | their `defaultBinding` keystrokes |
| `tool.activate:<id>` | their `defaultBinding` keystrokes |
| `tool.hold:hand` | `{ kind: 'key-held', key: ' ' }` |

## Tool catalog after migration

Tools that survive (palette entries):

`select`, `rect`, `ellipse`, `line`, `polygon`, `star`, `pencil`,
`text`, `pen`, `editAnchors`, `eyedropper`, `lasso`, `hand`, `clone`,
plus the shape bundle expansion (chevron/notched/etc. for badge work
if relevant).

Tools that dissolve:

`wheel-pan`, `wheel-zoom`, `keyboard-zoom`, `pinch-zoom`, `nudge`,
`delete`, `duplicate`, `undoRedo`, `color-context` (consumer-side
Swill).

## Phased plan

One branch (`registry-unification`), nine commits. Each commit keeps
the kit green (`tsc --noEmit && vitest run && tsup build`).

1. **Types + skeleton.** Introduce `Action`, `Invoker`, `GestureSpec`,
   `GestureBinding`, `Tool`, `ActiveToolContext`. Wire `Action` and
   `Invoker` into the existing registry as additions (existing
   `Action.run` continues to work in this commit only — preserved for
   incremental porting, removed in phase 8).
2. **Populate `gestureBinding` on existing immediate actions.** Pure
   structural change: every existing one-shot action gains a typed
   `GestureSpec` for its keybinding. Existing dispatch unchanged.
3. **Build the gesture dispatcher.** New module
   `src/interactions/dispatcher/` reading active-tool context, ambient
   bindings, tool bindings; matching `GestureSpec` against input
   events; pumping `OngoingHandle`. Tests cover precedence, scope
   collection, phase pumping, pointercancel/escape.
4. **Introduce `ActiveToolContext`.** Replace the existing tools-state
   machinery with the context. Tool registry stays a separate
   build-time `Map<id, Tool>`. Hotkey stack moves to context. The old
   slot mechanics (`active` / `hotkey` / `ambient` slots in the tool
   dispatcher) collapse to: `active` = `context.active`, `hotkey` =
   `context.hotkeyStack`, `ambient` = global ambient bindings.
5. **Port `move` end-to-end.** Proof-of-shape commit. Define `move` as
   an ongoing action; rewrite `useSelectTool`'s move binding to a
   `GestureBinding`. `useMove` hook stays (other tools still use it)
   but now delegates to the registered action. Use this commit to
   validate the dispatcher contract works on a real case.
6. **Port remaining ongoing actions.** `resize`, `rotate`, `areaSelect`,
   `lassoSelect`, `insert`, `clone`, `editAnchors`,
   `viewport.pinchZoom`. Tools update their bindings tables.
7. **Port ambient tools to ambient bindings.** Delete the eight
   wrapper-tools (`useWheelPanTool`, `useWheelZoomTool`,
   `useKeyboardZoomTool`, `usePinchZoomTool`, `useNudgeTool`,
   `useDeleteTool`, `useDuplicateTool`, `useUndoRedoTool`). Replace
   with ambient `GestureBinding[]` registered at kit-init time. Move
   `tool.hold:hand` into this list.
8. **Restructure Swill's color context.** `useColorContextTool` →
   `<ColorContextProvider>` + three immediate actions (`color.reset`,
   `color.swap`, `color.toggleFocusedNone`) with their `defaultBinding`
   populated. Property panel and eyedropper consume the context
   directly.
9. **Delete legacy.** Remove `useMove`/`useResize`/`useRotate`/etc.
   hook surfaces (now only the registered actions remain). Remove
   `Action.run` legacy field; everything goes through `Invoker`.
   Remove the old tool-slot dispatcher code. Update `docs/taxonomy.md`
   (drop the "narrower historical definition" caveat), `docs/TODO.md`
   (delete the "Taxonomy alignment" section's last item), and demos
   that hand-wired old hooks.

## Risks / open items

- **Phase 5 integration risk.** If the gesture dispatcher can't
  cleanly express `useSelectTool`'s current composition (drag-on-anchor
  → editAnchors; drag-on-body → move; drag-on-corner-handle → resize;
  drag-on-rotation-handle → rotate; drag-on-empty → areaSelect), the
  dispatcher design needs revision. This is the load-bearing
  validation point; build the test against select-tool first.

- **`tool.activate:<id>` namespace explosion.** One action per tool ×
  N tools = N entries in the registry. Acceptable (≈14 tools today)
  but lean on `presentation.group: 'tools'` so command palette can
  group them. Alternative: a single parametric `tool.activate(id)`
  action with id-bound variants generated at registration time.
  Sticking with one-per-tool for now (matches existing `align.left` /
  `align.right` precedent of explicit ids over parametric reflection).

- **Target-spec evolution.** `TargetSpec`'s `kind:<name>` form depends
  on the not-yet-built kit-owned object-kind registry (TODO.md Tier 1).
  In the interim, `TargetSpec` accepts `{ kindOf: predicate }` escape
  hatch so consumers can hand-write classifiers. When the registry
  lands, the string-form sugar takes precedence.

- **Pinch-zoom multi-touch normalization.** The dispatcher needs a
  multi-touch input source. Today multi-touch is read via
  `PointerEvent`s with `pointerType === 'touch'`. The dispatcher
  collects matching pointers and synthesizes a `MultiTouchInvocationCtx`.
  Behavior parity with `usePinchZoomTool` must be verified.

- **Behavior-config persistence across tool switches.** A
  `GestureBinding`'s `opts.behaviors` is per-Tool, so switching tools
  switches the active behavior chain. Verify there's no expectation
  today that a behavior persists across tool switches.

- **`OngoingHandle` granularity.** `onMove` and `onEnd` cover the
  current per-action contract, but `useEditAnchors` has richer
  per-phase state (anchor drag, handle drag, alt-drag-for-handle). May
  need an extension point for richer phase callbacks. Validate during
  phase 6 port.

## Acceptance

- All ~25 action entry points (registry table above) ported.
- Zero references to `useMove`/`useResize`/`useRotate`/`useAreaSelect`/
  `useInsert`/`useClone`/`useLassoSelect`/`useEditAnchors` outside the
  internal action implementations.
- Zero references to the eight wrapper-tools
  (`useWheelPanTool`/`useWheelZoomTool`/`useKeyboardZoomTool`/
  `usePinchZoomTool`/`useNudgeTool`/`useDeleteTool`/
  `useDuplicateTool`/`useUndoRedoTool`).
- `useColorContextTool` deleted in Swill; replaced by
  `<ColorContextProvider>` + actions.
- `prepublishOnly` green (`tsc --noEmit && vitest run && tsup build`).
- `build:demo` green.
- `docs/taxonomy.md` "narrower historical definition" caveat removed.
- `docs/TODO.md` "Taxonomy alignment" section retains only items that
  are still genuinely open (or the section is deleted entirely if
  everything ships).
- Swillustrator smoke test: all five tools work (select/insert/text/
  pen/hand), color context works (D/X/Shift-X//), wheel-pan/zoom work,
  keyboard zoom works, pinch-zoom works (touch device), all keybindings
  work (delete, duplicate, undo/redo, nudge, group/ungroup,
  align/distribute/flip, clipboard, pathfinder).

## Out-of-scope follow-ups

- **Wheel-binding parameter shape.** `viewport.zoom` bound to wheel
  needs a factor derived from `deltaY`. The current
  `useWheelZoomTool` hardcodes a step curve. Spec doesn't address
  whether the action computes from raw `WheelEvent` deltas or the
  binding's `opts` carry a curve function. Resolve during phase 7
  port.

- **Action conflict detection across scopes.** Two tools binding
  different actions to the same `{ kind: 'drag', target: 'empty' }` is
  fine (they're never both active). Two ambient bindings on the same
  spec is a real conflict. The existing action registry has
  conflict-detection machinery (`registry.conflicts.test.tsx`); extend
  to cover gesture-spec conflicts.

- **Tool overlay rendering.** This spec keeps `Tool.overlay` as one
  `RenderLayer` matching today. The "Tool overlay channel deferrals"
  TODO entries (per-overlay z-positioning, multiple overlays per tool,
  push subscription model) remain deferred.

- **Action introspection API.** `useAction(id)` for consumer-side
  invocation, `useActionList()` for command palette/help surface.
  Defer to the existing palette work; this spec just guarantees the
  data shape exists.
