# Declarative tool routing — design

Date: 2026-05-12
Status: design, awaiting plan.

Source: `docs/proposals/2026-05-12-declarative-tool-routing.md` (the
exploration this spec promotes). Gaps surfaced in the 2026-05-12
review (target-kind grammar, HitResult shape, claim/none, continuation
returns, dispatch precedence, lifecycle, pointercancel) are resolved
inline below. The phase-name rename (`active` → `engaged`) and the
existing-export rename (`HitResult` → `AffordanceBinding`) are
committed-to in this spec.

## Goal

Replace the kit's imperative tool channels (`pointer`, `drag`,
`dblTap`, `keyboard`, `wheel`) with a declarative routing model: each
tool declares a table mapping `(gesture × target × modifiers) → action`,
the dispatcher resolves at event time, and tool behavior becomes data
the kit can introspect.

Driver: text-edit-on-dblclick belongs to both the select tool and the
text tool (per Illustrator/Figma convention). Today each tool reimplements
the hit-test + dispatch logic. The new model lets both tools route to a
shared `enterTextEdit` action by name; the kit also gets cross-cutting
benefits (action registry, conflict detection, debug overlay).

The kit ships two factories:

1. **`defineTool`** for **targeted tools** — operate on objects. Most
   tools fit here: `useSelectTool`, `useTextTool`, `useLassoTool`,
   `useUserPenTool`, `useEditAnchorsTool`, all shape tools.
2. **`defineViewportTool`** for **viewport tools** — operate on the
   viewport itself, no targets. Hand, wheel-zoom, pinch-zoom,
   keyboard-zoom, wheel-pan.

`defineViewportTool`'s spec type is mechanically derived from
`defineTool`'s via `Pick`/`Omit` so it's a compile-time strict subset.
Both produce the same underlying `Tool<TScratch>` for the dispatcher.

## Non-goals

- Replacing the dispatcher's slot model (`active` / `hotkey` /
  `ambient`). Slots stay as-is — phase is orthogonal.
- Closed-set target kinds. Consumers register their own; the kit
  routes by string key.
- Multi-pointer gestures (pinch, two-finger pan). These use the
  separate `pinch` channel today; out of scope here.
- 3+ phase tools (wizard-style multi-step). Two-phase (idle/engaged)
  covers every kit-known case; defer until a real need surfaces.

## Phase shape

Two distinct concepts share the word "active" in the kit's vocabulary,
which is what motivates the rename:

- **Active slot** (dispatcher concept) — the currently-selected tool.
  One tool occupies the active slot. Switching tools via the toolbar
  or keybinding changes who's in the active slot.
- **Engaged phase** (tool-internal concept) — the tool is mid-gesture
  (scratch is non-null). Phase change is internal to the tool;
  switching slots doesn't change phase.

A tool can be in any combination:

| In active slot? | In engaged phase? | What's happening |
|---|---|---|
| Yes | No  | Just selected, waiting for input |
| Yes | Yes | Selected AND mid-gesture |
| No  | No  | Registered but inactive |
| No  | Yes | (impossible — must be in a slot to engage) |

Targeted tools fit one of two shapes:

- **Phase-free** — a click or dblTap fires an action and returns to
  rest. No "in-progress" state. Select tool (when not in a drag) is
  phase-free for its click-to-select behavior.
- **Two-phase** — `idle ↔ engaged`. Some gestures start engaged phase,
  some end it. Within engaged, scratch holds the accumulator and
  continuation handlers drive the mid-gesture rendering.

Two-phase covers drag-gestures (resize, move, insert), modal flows
(pen mid-creation, text mid-edit), and any "begin → progress → commit"
shape. The kit ships exactly one phase distinction: the `engaged`
phase exists when `scratch !== null`. Sub-phase nuance — e.g., pen
tool's "hovering the first anchor about to close" — lives in scratch
fields, not as distinct states.

## Factories

```ts
function defineTool<TScratch = void>(
  spec: ToolDef<TScratch>,
): Tool<TScratch>;

function defineViewportTool<TScratch = void>(
  spec: ViewportToolDef<TScratch>,
): Tool<TScratch>;
```

`TScratch` defaults to `void` so phase-free tools can't accidentally
call `begin(...)` — it'd be a type error. Authors opt into the
engaged phase by parameterizing.

No `TTargetKind` / `TPose` / `TData` generics. The kit can't own a
closed target-kind set (consumers register their own); route table
keys stay `string`. `ctx.target.pose` and `ctx.target.data` are typed
as `unknown` and cast at the use site, matching the existing
`adapter: unknown` convention.

## Spec shapes

```ts
interface ToolDef<TScratch = void> {
  id: string;
  presentation?: ToolPresentation<TScratch>;
  keybinding?: KeyBinding;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  /** Default cursor while this tool is in the active slot. Can be a
   *  static string or a function of context (including scratch for
   *  finer-grained variations). Overridden per-phase via `PhaseDef.cursor`. */
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  initial: PhaseDef<TScratch>;
  engaged?: PhaseDef<TScratch>;   // omit for phase-free tools
}

interface PhaseDef<TScratch> {
  click?:   RouteTable<TScratch>;
  dblTap?:  RouteTable<TScratch>;
  drag?:    RouteTable<TScratch>;
  wheel?:   ActionFn<TScratch>;
  keyDown?: Record<string, ActionFn<TScratch>>;
  keyUp?:   Record<string, ActionFn<TScratch>>;
  /** Cursor override while in this phase. Falls back to `Tool.cursor`
   *  when omitted. Same signature — static string or function. */
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  /** Optional overlay layer rendered while the tool is in this phase. */
  overlay?: (ctx: ToolCtx<TScratch>) => RenderLayer<unknown>;
  claimsAll?: boolean;
}

type RouteTable<TScratch> = Partial<Record<string, RouteEntry<TScratch>>>;
type RouteEntry<TScratch> = ActionFn<TScratch> | ModifierRoute<TScratch>;
type ModifierRoute<TScratch> = Partial<Record<ModifierKey, ActionFn<TScratch>>>;

type ModifierKey =
  | 'default'
  | 'mod' | 'shift' | 'alt'
  | 'mod+shift' | 'mod+alt' | 'shift+alt'
  | 'mod+shift+alt';

type ActionFn<TScratch> = (ctx: ToolCtx<TScratch>) => Result<TScratch>;

interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;        // default 0
  onMove?:    (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>) => void | Result<TScratch>;
}
```

### Viewport-tool spec — strict subset of ToolDef

```ts
type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'keyUp' | 'claimsAll'
> & {
  drag?: ActionFn<TScratch>;   // narrows from RouteTable | ActionFn
};

type ViewportToolDef<TScratch = void> = Omit<
  ToolDef<TScratch>, 'initial' | 'engaged'
> & {
  initial: ViewportPhaseDef<TScratch>;
  engaged?: ViewportPhaseDef<TScratch>;
};
```

`ViewportToolDef` mechanically drops `click` / `dblTap` and narrows
`drag` from route table to plain `ActionFn`. The Pick/Omit derivation
makes the subset relationship compiler-enforced — adding a field to
`PhaseDef` is automatically considered for viewport tools only if the
`Pick` lists it.

## Action vocabulary

Seven results the dispatcher consumes. Five are constructed actions;
two are status markers (`claim`/`none`) but exposed as constructors
for symmetry. The full `Result` union:

```ts
type Result<TScratch> =
  | { kind: 'apply';  ops: Op[]; label?: string }
  | { kind: 'begin';  spec: BeginSpec<TScratch> }
  | { kind: 'hold';   scratch: TScratch }
  | { kind: 'commit'; ops: Op[]; label?: string }
  | { kind: 'cancel' }
  | { kind: 'claim' }
  | { kind: 'none' };
```

| Constructor | Effect | Phase |
|---|---|---|
| `apply(ops, label?)` | Dispatch ops through adapter's `applyOps`. | no change |
| `begin(spec)` | Open engaged phase with this scratch + continuation closures. | idle → engaged |
| `hold(scratch)` | Update scratch; tool *holds* the new state. | stays engaged |
| `commit(ops, label?)` | Apply ops AND close engaged phase. | engaged → idle |
| `cancel()` | Close engaged phase without applying ops. | engaged → idle |
| `claim()` | Suppress fall-through to other slots; no other effect. | no change |
| `none()` | Pass to next slot. (Equivalent to returning `undefined`.) | no change |

The route table value type is `ActionFn | ModifierRoute`. Returning
`undefined` from an `ActionFn` is treated as `none()`.

## Target kind grammar

Hit-test produces one canonical kind string for the target under the
cursor:

- **`'empty'`** — no hit; an `EmptyHit` HitResult.
- **`'kind'`** — a node hit with no subkind (`'rect'`, `'text'`,
  `'path'`).
- **`'kind:subkind'`** — a node hit with a state/subkind modifier
  (`'rect:selected'`, `'rect:hovered'`).
- **`'affordance-kind'`** or **`'affordance:subkind'`** — an affordance
  hit (`'handle:bottom-right'`, `'rotation-handle'`, `'anchor:first'`).

### Lookup precedence

The dispatcher walks four levels of specificity, first match wins:

1. **Exact** — `'rect:selected'` matches `kind === 'rect:selected'`.
2. **Subkind wildcard** — `'*:selected'` matches any base kind with
   the `:selected` subkind.
3. **Base-kind** — `'rect'` matches any subkind of rect (including
   bare `'rect'`).
4. **Universal** — `'*'` matches any non-empty target.

`'empty'` is its own kind; it doesn't fall through to `'*'`. To match
both, list them separately.

Subkind wildcard ranks above base-kind because the typical reason to
write `'*:selected'` is "I want state-aware behavior across all base
kinds." If base-kind won the tie, that wildcard would never fire on a
specific base, defeating the purpose.

Grammar constraints:

- Single-level subkind only — no `'rect:selected:locked'`. Defer
  until a real case appears.
- `':'` is the only separator.
- `'kind:*'` is unnecessary — bare `'kind'` already matches any
  subkind.

## HitResult

The kit's existing `HitResult` (in `src/affordances/types.ts` — the
gesture-binding "which drag channel handles this hit") renames to
**`AffordanceBinding`**. The name `HitResult` is freed for the new
type below — what every route receives via `ctx.target`.

```ts
interface NodeRef {
  id: NodeId;
  pose: unknown;
  data: unknown;
  meta?: Record<string, unknown>;
}

interface EmptyHit {
  category: 'empty';
  kind: 'empty';
}

interface NodeHit extends NodeRef {
  category: 'node';
  kind: string;            // 'rect', 'rect:selected', 'text', etc.
}

interface AffordanceHit extends NodeRef {
  category: 'affordance';
  kind: string;            // 'handle:bottom-right', 'anchor:first', etc.
}

type HitResult = EmptyHit | NodeHit | AffordanceHit;

/** Convenience union: any hit that references a scene node. */
type NodeRefHit = NodeHit | AffordanceHit;
```

- **`category`** is the type-level discriminator. Actions narrow via
  `if (target.category === 'node')` to access category-specific fields.
- **`kind`** is the routing-table key. Different from category — the
  same category may produce many kinds (`'rect'`, `'rect:selected'`,
  `'rect:locked'` are all NodeHits).
- **`id` (NodeRefHit)** — the scene node hit (for `NodeHit`), or the
  scene node an affordance acts on (for `AffordanceHit`).
- **`pose` / `data` (NodeRefHit)** — node's pose and data; typed as
  `unknown`, cast at the use site.
- **`meta` (NodeRefHit)** — kind-specific extras. Schema owned by the
  hit-tester per kind (e.g., `'anchor:first'` → `{ index: 0 }`,
  `'handle:bottom-right'` → `{ handle: 'br' }`).

Composition pays off: `ctx.target.id` works uniformly for both
`NodeHit` and `AffordanceHit` without branching on category. Affordance
hits aren't a separate "thing in space" — they're a hit on the chrome
of a node, so they share the node-reference fields.

## ToolCtx

```ts
interface ToolCtx<TScratch = void> {
  point: { x: number; y: number };   // world coords of the event
  target: HitResult;                  // discriminated hit result
  modifiers: ToolModifiers;           // shift/alt/ctrl/meta/space snapshot
  scratch: TScratch;                  // typed; void when not engaged
  view: View;
  setView: (next: View) => void;
  applyOps: (ops: Op[], label?: string) => void;
  selection: SelectionApi;
  adapter: unknown;                   // cast at use site
  canvasRect: DOMRect;
  debug?: DebugSink;
}
```

`ctx.point` replaces the kit's existing `worldX`/`worldY` pair (same
data, cleaner shape). The other fields preserve the current
`ToolCtx` contract — the new model is additive on `target` and
`scratch` (which today is `unknown`; the new factory types it).

## Modifier handling

Routes can be a plain `ActionFn` (no modifier discrimination) or a
sub-table keyed by modifier combination:

```ts
type ModifierKey =
  | 'default'
  | 'mod' | 'shift' | 'alt'
  | 'mod+shift' | 'mod+alt' | 'shift+alt'
  | 'mod+shift+alt';
```

Eight valid keys: `'default'` (no modifiers), three singles, three
pairs, one triple. Canonical order matches `formatShortcut`:
**`mod → shift → alt`**. The strict union gives autocomplete and
catches typos at compile time.

Lookup is **exact-match only**. No fuzzy fallback to a subset of
modifiers; partial matches fall through to `'default'`. To make
shift+alt behave like shift, spell it out:

```ts
'rect': {
  default:     selectOnly,
  shift:       addToSelection,
  'shift+alt': addToSelection,   // same action, explicit
}
```

`mod` is the cross-platform abstraction — `Cmd` on Mac, `Ctrl` on
Windows/Linux. The raw `ctrl` and `meta` flags remain available on
`ctx.modifiers` for tools that need to discriminate (drop to function
form for those). `space` is intentionally absent — hold-engage uses
the dispatcher's `hotkey` field on `Tool`.

### `mods()` convenience helper

```ts
function mods(...keys: ReadonlyArray<'mod' | 'shift' | 'alt'>): ModifierKey {
  if (keys.length === 0) return 'default';
  const set = new Set(keys);
  return [
    set.has('mod')   && 'mod',
    set.has('shift') && 'shift',
    set.has('alt')   && 'alt',
  ].filter(Boolean).join('+') as ModifierKey;
}

// Usage:
'rect': {
  [mods()]:               selectOnly,
  [mods('shift')]:        addToSelection,
  [mods('alt', 'shift')]: cloneAndAdd,    // canonicalizes to 'shift+alt'
}
```

Computed-key syntax is slightly noisier than string literals; both
forms work. The helper exists for authors who don't want to memorize
the canonical order.

Function form is the escape hatch for arbitrary predicates that go
beyond the eight canonical combos:

```ts
'rect': (ctx) => ctx.modifiers.shift && ctx.scratch?.kind === 'special'
  ? specialAction(ctx)
  : selectOnly(ctx),
```

## Continuations

Drag-shaped gestures attach continuation closures at `begin` time:

```ts
const beginMove: ActionFn<MoveScratch> = (ctx) => begin({
  scratch: { kind: 'move', startPoses: snapshotSelected(ctx) },
  thresholdPx: 5,
  onMove:    (ctx) => hold(previewMove(ctx.scratch, ctx.point)),
  onRelease: (ctx) => commit([moveOp(ctx.scratch)], 'Move'),
  onCancel:  () => undefined,
});
```

The dispatcher routes `pointermove` / `pointerup` / `pointercancel`
into these closures automatically while the tool is engaged.

Click-sequence gestures (pen) don't attach continuations — each
subsequent click routes through `engaged.click` instead:

```ts
engaged: {
  click: {
    'anchor:first': (ctx) => commit([closePathOp(ctx.scratch.anchors)]),
    '*':            (ctx) => hold({ anchors: [...ctx.scratch.anchors, ctx.point] }),
  },
}
```

Same `begin/hold/commit/cancel` primitives, different usage shape:
"begin + auto-continuation" vs. "begin + dispatch-into-engaged." The
dispatcher unifies them.

Continuation handlers return `Result<TScratch>` — full action
vocabulary. So `onMove` can return `commit(ops)` to auto-finish mid-drag
(distance-based commits, threshold-passed commits, etc.).

## Dispatch precedence

Phase doesn't change the slot pipeline. The dispatcher's existing slot
order is preserved:

```
hotkey > active > ambient
```

Each slot holds one tool. Within a slot, the tool's *phase*
determines which route tables the dispatcher consults (initial vs.
engaged). A tool in engaged phase still loses to a hotkey-slot tool —
e.g., space-held hand temporarily takes over even if the active-slot
tool is mid-drag. Phase isn't a fourth slot.

Returning `claim()` from an action stops fall-through within the slot
pipeline. Returning `none()` (or `undefined`) lets the dispatcher
continue to the next slot's tool.

### Engaged-while-in-engaged

If an action in `engaged` phase returns `begin(...)`, the dispatcher
fires a dev-mode error (the tool's already engaged) and treats it as
a no-op in production. To re-init the engaged phase with fresh
scratch, an author should `cancel()` then dispatch a fresh route —
not call `begin` from within engaged.

### Cross-tool fall-through via ambient handlers

A useful idiom that falls out of the slot pipeline naturally: a tool
registered in the `ambient` slot can provide cross-tool fall-through
behavior for events the active-slot tool doesn't claim.

Example: regardless of which tool is active (Pen, Rect, Lasso, etc.),
the user should always be able to double-tap a text node to enter
text edit. Rather than copy the dblTap route into every tool's table,
register a single ambient tool that owns the cross-tool behavior:

```ts
const UniversalEditEntry = defineTool({
  id: 'universal-edit-entry',
  initial: {
    dblTap: {
      'text': enterTextEdit,
      'path': enterAnchorEdit,
    },
  },
});

useTools({
  active: penTool,
  ambient: [
    useWheelZoomTool(),
    useWheelPanTool(),
    UniversalEditEntry,
  ],
});
```

Now while Pen is active:
- User dbltaps a path → Pen claims (its `dblTap.'path'` route).
- User dbltaps text → Pen has no route → falls through → ambient
  `UniversalEditEntry` claims via `dblTap.'text'`.
- User dbltaps a rect → Pen has no route → ambient has no route →
  silently unhandled.

The active tool gets first dibs (so it can shadow ambient if it
wants to); the ambient handler fires only when the active doesn't
claim. Modal tools that don't want fall-through (e.g., Pen
mid-creation in engaged phase) suppress it with `claimsAll: true`.

**Caveats:**

- *Behavior lives away from its tool.* A maintainer reading Pen's
  source won't see why dbltap-text enters edit mode. Name the ambient
  tool descriptively and document the fall-throughs it provides.
- *The kit doesn't ship this.* `UniversalEditEntry` is a recipe, not
  a default. Different consumers want different fall-through policies
  (Illustrator-style stays tool-bound, Figma-style snaps back to
  select). Shipping one as default would be opinionated wrongly.
- *Multiple ambient fall-through tools.* If you register two ambient
  tools that both have `dblTap.'text'` routes, the first one to claim
  wins. Don't double up.

## Lifecycle hooks

`onActivate(ctx)` and `onDeactivate(ctx)` are top-level `ToolDef`
callbacks. They fire on slot transitions (entering or leaving the
active slot), not phase transitions:

```ts
defineTool({
  id: 'mytool',
  onActivate:   (ctx) => subscribeExternalState(),
  onDeactivate: (ctx) => unsubscribeExternalState(),
  // ...
})
```

Return type is `void`. These are side-effect hooks, not action
handlers — they can't dispatch ops via the Result vocabulary. If they
need to dispatch ops imperatively, they call `ctx.applyOps(...)`
directly (rare; likely anti-pattern).

**Edge case: tool is engaged when its slot is taken away.** The
dispatcher calls `onCancel` first (to clean up scratch), then
`onDeactivate` (to release slot-level subscriptions). Matches today's
behavior.

## Pointercancel and edge cases

### Pointer capture on drag begin

When a route returns `begin(spec)` with `onMove`/`onRelease` attached,
the dispatcher calls `element.setPointerCapture(pointerId)` on the
canvas. Browser-native:

- User drags outside canvas → `onMove` keeps firing.
- User releases outside canvas → `onRelease` fires on canvas.
- Capture auto-releases on pointerup.

Without this, a drag-and-release-off-canvas leaves the tool stuck in
engaged phase. The kit captures unconditionally on begin.

### Pointercancel and window blur

`pointercancel` (OS interruption — palm rejection, system gesture)
fires the tool's `onCancel` continuation handler and exits engaged
phase.

Browsers don't reliably fire `pointercancel` when the user alt-tabs
mid-drag, so the dispatcher also listens for `blur` on `window` while
engaged and treats it as a pointercancel.

### Escape: opt-in per tool

Escape is not a dispatcher special case. Tools wire it through
`engaged.keyDown.'Escape'`:

```ts
engaged: { keyDown: { 'Escape': cancel } }
```

Per-tool opt-in lets some tools use Escape for non-cancel semantics
(rare but allowed).

### Re-entry

User drags off canvas, comes back, releases: pointer capture means
the original tool's `onRelease` fires normally. The gesture is bound
to the tool that initiated; you can't switch tools mid-gesture.

User releases off-canvas, then later clicks: previous gesture ended
cleanly at release time; new click dispatches normally.

User pointerdowns while already engaged (multi-touch): the kit's
primary-pointer policy applies — only the first pointer to enter
engaged is the "primary"; subsequent pointers either ignore
(single-pointer tools) or feed into the separate `pinch` channel
(multi-pointer tools).

## Sample tools

### Select (phase-free + drag opens phase)

```ts
const SelectTool = defineTool<MoveScratch | MarqueeScratch>({
  id: 'select',
  presentation: { label: 'Select', icon: <SelectIcon />, group: 'select' },
  keybinding: { key: 'v' },
  initial: {
    click: {
      'rect':  (ctx) => apply([setSelection([ctx.target.id])], 'Select'),
      'text':  (ctx) => apply([setSelection([ctx.target.id])], 'Select'),
      'path':  (ctx) => apply([setSelection([ctx.target.id])], 'Select'),
      'empty': (ctx) => apply([setSelection([])], 'Deselect'),
    },
    dblTap: {
      'text': enterTextEdit,
      'path': enterAnchorEdit,
    },
    drag: {
      'rect':  beginMove,
      'text':  beginMove,
      'path':  beginMove,
      'empty': beginMarquee,
    },
  },
  engaged: {
    keyDown: { 'Escape': cancel },
  },
});
```

### Rect insert (pure drag-gesture, uniform behavior)

The rect-insert tool's drag behavior is uniform — every drag inserts
a rect, regardless of what (if anything) is under the cursor at
pointerdown. So `drag` uses the function form (no route table), not a
keyed entry on `'empty'`. Reads as "any drag fires this":

```ts
const RectInsertTool = defineTool<{ start: Point; current: Point }>({
  id: 'insert-rect',
  presentation: { label: 'Rectangle', icon: <RectIcon />, group: 'shape' },
  keybinding: { key: 'r' },
  cursor: 'crosshair',
  initial: {
    drag: (ctx) => begin({   // function form — any pointerdown fires
      scratch: { start: ctx.point, current: ctx.point },
      thresholdPx: 5,
      onMove:    (ctx) => hold({ ...ctx.scratch, current: ctx.point }),
      onRelease: (ctx) => commit([createInsertOp(rectFromBounds(ctx.scratch))], 'Insert Rect'),
    }),
  },
  engaged: {
    keyDown: { 'Escape': cancel },
    claimsAll: true,
  },
});
```

**Function-form drag vs. target-keyed drag.** Use function form when
drag behavior is uniform (insert tools, shape tools — every drag does
the same thing regardless of target). Use target-keyed routing when
drag behavior is target-dependent (select tool: drag-on-rect → move,
drag-on-empty → marquee). If a tool wants to *only* fire on empty
canvas — say, an Illustrator-style insert that suppresses itself over
existing objects — use a single-entry routing table:
`drag: { 'empty': ... }`. Most insert/shape tools want uniform
behavior, so function form is the default shape for them.

### Hand (viewport tool — untargeted drag)

```ts
const HandTool = defineViewportTool<{ startView: View; startPoint: Point }>({
  id: 'hand',
  presentation: { label: 'Hand', icon: <HandIcon />, group: 'view' },
  keybinding: { key: 'h' },
  cursor: 'grab',                    // default — hovering, ready to grab
  initial: {
    drag: (ctx) => begin({
      scratch: { startView: ctx.view, startPoint: ctx.point },
      onMove: (ctx) => {
        ctx.setView({
          ...ctx.scratch.startView,
          x: ctx.scratch.startView.x + (ctx.point.x - ctx.scratch.startPoint.x),
          y: ctx.scratch.startView.y + (ctx.point.y - ctx.scratch.startPoint.y),
        });
        return hold(ctx.scratch);
      },
      onRelease: cancel,   // view changes aren't undoable
    }),
  },
  engaged: {
    cursor: 'grabbing',              // overrides during the drag
  },
});
```

### Pen (multi-click path)

```ts
const PenTool = defineTool<{ anchors: Point[] }>({
  id: 'pen',
  presentation: { label: 'Pen', icon: <PenIcon />, group: 'draw' },
  keybinding: { key: 'p' },
  cursor: 'crosshair',
  initial: {
    click: {
      'empty': (ctx) => begin({ scratch: { anchors: [ctx.point] } }),
    },
    dblTap: {
      'path': enterAnchorEdit,
    },
  },
  engaged: {
    click: {
      'anchor:first': (ctx) => commit([closePathOp(ctx.scratch.anchors)], 'Close path'),
      '*':            (ctx) => hold({ anchors: [...ctx.scratch.anchors, ctx.point] }),
    },
    keyDown: {
      'Escape': cancel,
      'Enter':  (ctx) => commit([commitPathOp(ctx.scratch.anchors)], 'Commit path'),
    },
    claimsAll: true,
  },
});
```

### Text (context-aware Illustrator-style)

```ts
const TextTool = defineTool({
  id: 'text',
  presentation: { label: 'Text', icon: <TextIcon />, group: 'type' },
  keybinding: { key: 't' },
  cursor: 'text',                  // I-beam while idle
  initial: {
    click: {
      'text':  enterTextEdit,
      'empty': (ctx) => apply([insertTextOp({ point: ctx.point })], 'Insert text'),
    },
    drag: {
      'empty': (ctx) => begin({
        scratch: { start: ctx.point, current: ctx.point },
        thresholdPx: 5,
        onMove:    (ctx) => hold({ ...ctx.scratch, current: ctx.point }),
        onRelease: (ctx) => commit([createTextBoxOp(rectFromBounds(ctx.scratch))], 'Insert text box'),
      }),
    },
  },
  engaged: {
    cursor: 'crosshair',            // overrides while drag-creating a box
    keyDown: { 'Escape': cancel },
  },
});
```

`enterTextEdit` is the shared action — `SelectTool` and `TextTool`
both reference it. The composable piece that motivated this whole
exercise.

## Reflection consumers (the framework promise)

Once every tool is data, the kit gets these for free — but they have
to be built, or the data shape is just ceremony. Commit to all three:

1. **Action registry.** Walk every tool's tables; every `ActionFn`
   with a stable identity becomes a registerable action that
   palettes / menus / keyboard shortcuts can fire by name.
2. **Conflict detection at boot.** Two tools claiming the same
   `(slot × gesture × target × modifier)` is a static error the
   dispatcher surfaces at registration.
3. **Tool-introspection debug overlay.** "You're in `engaged` phase
   of PenTool; valid gestures here are click→{anchor:first, *} and
   keyDown→{Escape, Enter}."

The reflection consumers ship in parallel with the second built-in
migration (see Phasing below), not before. Building them against a
real second consumer validates the data shape before it's locked.

## Phasing

The implementation is split into bite-sized phases:

1. **Foundation.** `defineTool` factory, `defineViewportTool` factory,
   action constructors, `Result` types, `ToolCtx` extensions, `HitResult`
   shape, `AffordanceBinding` rename of the existing `HitResult`, and
   the kit-wide `applyBatch` → `applyOps` rename. Ship under an
   experimental import path; existing imperative channels keep working
   unchanged.

2. **First migration: useHandTool.** Smallest tool (untargeted, single
   gesture, simple scratch). Validates the basic shape without
   exercising routing tables. Build alongside Phase 1.

3. **Second migration: useSelectTool.** Largest target surface
   (`'rect'`, `'text'`, `'path'`, `'empty'`), exercises modifier
   sub-tables (shift-extend, alt-clone), multi-shape engaged phase
   (move vs. marquee). The canonical "everything in the schema"
   example.

4. **Reflection consumers.** Build action registry, conflict
   checker, debug overlay against the migrated tools from phases 2/3.
   These validate the data shape works for cross-tool concerns
   before locking it.

5. **Remaining built-ins.** `useLassoTool`, `useInsertTool`,
   `useTextTool`, `useUserPenTool`, `useEditAnchorsTool`, plus the
   five shape tools (Ellipse, Line, Polygon, Star, Pencil). Each
   migrates independently. Drag-controller React hooks
   (`useDragRect`, `useDragRadial`) dissolve into pure helper
   modules during this phase.

6. **Deprecation (optional).** Once all built-ins migrated, mark the
   imperative channels (`pointer`, `drag.onStart/onEnd/onCancel`,
   `keyboard`, `wheel`, `dblTap`) as `@deprecated`. They can stay
   indefinitely as an escape hatch for consumer tools that don't fit
   the routing model — no hard removal.

## Migration mechanics

Two concrete shape changes existing tools need to absorb:

### Scratch mutation → functional update

Current tools mutate `ctx.scratch` directly:

```ts
// Before
ctx.scratch = { samples: [{ x, y }] };
ctx.scratch.samples.push({ x, y });
```

The new model uses `hold({ ...scratch, patch })` from a returned
Result. Mechanical conversion:

```ts
// After
return hold({ ...ctx.scratch, samples: [...ctx.scratch.samples, { x, y }] });
```

### React-hook drag controllers → pure helpers

Three of the five shape tools (Ellipse, Polygon, Star) compose with
`useDragRect` / `useDragRadial` React hooks that hold their own
state outside the tool. The new model wants scratch on the tool, so
these hooks dissolve into **pure helper modules**:

```ts
// Pure helper, not a React hook
function dragRectBounds(start: Point, current: Point, mods: Modifiers): Bounds { ... }

// Tool inlines the closures, calls pure helpers
const EllipseTool = defineTool<{ start: Point; current: Point }>({
  // ...
  initial: {
    drag: (ctx) => begin({
      scratch: { start: ctx.point, current: ctx.point },
      onMove:    (ctx) => hold({ ...ctx.scratch, current: ctx.point }),
      onRelease: (ctx) => {
        const bounds = dragRectBounds(ctx.scratch.start, ctx.scratch.current, ctx.modifiers);
        const node = makeEllipse(bounds);
        return commit([createInsertOp({ node })], 'Insert ellipse');
      },
    }),
  },
  engaged: {
    keyDown: { 'Escape': cancel },
    overlay: (ctx) => dragRectOverlay(
      dragRectBounds(ctx.scratch.start, ctx.scratch.current, ctx.modifiers),
    ),
    claimsAll: true,
  },
});
```

The bounds math (`dragRectBounds`) stays shared as a pure function; a
bug fix in it still propagates everywhere. The React hook wrapper
goes away — its purpose was holding state via `useRef`, which scratch
now does.

### Imperative `drag.onEnd` → `drag.onRelease`

The kit's existing `Tool.drag` channel uses `onEnd` for the pointerup
handler. The new schema settles on `onRelease`; the imperative escape-
hatch channel renames its handler to match. `onStart` stays — drag-
onset is threshold-gated and doesn't map to a single user verb the
way release does.

## Open follow-ups

- **3+ phase tools.** Not in scope. If a wizard-style tool needs
  `idle → drawing → previewing → committed → idle`, the design needs
  a `defineMultiPhaseTool` factory. Defer until a real case appears.
- **Cross-tool coordination.** Reading another tool's scratch is
  rare; route through the dispatcher's published-state surface, not
  direct tool-to-tool access.
- **Hover routing.** A `hover` slot on `PhaseDef` would let tools
  declare hover-time affordances declaratively (cursor change,
  preview highlight). Not in v1; current `pointer.onMove` works.
- **Drag-controller utilities.** Once `useDragRect` / `useDragRadial`
  dissolve into pure helpers, a small utilities module documents the
  pure functions and points consumers at them.

## Risk / open items

- **TypeScript inference for scratch.** `defineTool<TScratch>` should
  flow `TScratch` through `BeginSpec`, `ToolCtx`, action constructors.
  TS inference handles this for explicit annotations; the auto-
  inference case (no generic on `defineTool`, scratch typed in
  begin's spec literal) needs testing.
- **Action identity for the registry.** Two tools referencing the
  same `enterTextEdit` action function: are they "the same action"
  for the registry? Identity by function reference works in the
  trivial case but breaks if `enterTextEdit` is recreated by `useMemo`
  with different deps. Spec needs to commit to either a stable
  identity (name-based registration) or reference-based (consumers
  manage identity).
- **Modifier matrix coverage.** 8 keys × N route entries × M tools
  could grow into a large search at dispatch time. Hash-based lookup
  is O(1) per entry; should benchmark with realistic tool counts.
- **Cursor publication on phase transitions.** Resolved: the dispatcher
  re-reads the cursor (phase override → tool default) on slot enter,
  phase enter, and phase exit. Function-form cursors (depending on
  scratch) are re-read on every scratch update — cheap, since cursor
  resolution is a single string lookup; no React re-render involved.

## Acceptance

Spec is done when:

- All factories defined and typed (`defineTool`, `defineViewportTool`,
  + action constructors).
- `HitResult` shape shipped; existing `HitResult` renamed to
  `AffordanceBinding`.
- `useHandTool` migrated as the canonical viewport-tool example.
- `useSelectTool` migrated as the canonical targeted-tool example
  with multi-shape engaged phase.
- Action registry, conflict checker, and debug overlay shipped
  consuming the migrated tools.
- `prepublishOnly` green (tsc clean, vitest pass, tsup build clean).
- Demo wiring updated: `<ToolPalette>` reads from the new metadata
  consistently.

Remaining built-ins and the five shape tools migrate in subsequent
phases; they're not part of the acceptance criteria for the
foundation work.

## Phase 4.5 follow-up: factory completeness (shipped 2026-05-12)

Phase 3 Task 3's migration report surfaced two structural gaps in the
factory surface. Phase 4.5 closed both before the Phase 5 tool
migrations started.

### `PhaseDef.pointerDown`

`PhaseDef` now has a `pointerDown?: RouteTable<TScratch>` field
alongside `click` / `dblTap` / `drag`:

```ts
interface PhaseDef<TScratch> {
  click?:        RouteTable<TScratch>;
  dblTap?:       RouteTable<TScratch>;
  drag?:         RouteTable<TScratch> | ActionFn<TScratch>;
  pointerDown?:  RouteTable<TScratch>;   // NEW in 4.5
  // ...
}
```

Semantics: a `pointerDown` route runs synchronously on pointerdown,
before the dispatcher's threshold-gated click vs. drag classification.
Returning `begin(spec)` primes scratch for subsequent handlers in the
same gesture (the typical use). Returning `apply` / `commit` finishes
the gesture immediately (rare). Returning `none()` (or omitting the
route) passes through to the threshold-gated pipeline.

Used by `useSelectTool` to classify the body-hit gesture: "this rect
belongs to the existing selection so the drag will move the whole
set" vs. "this rect is a fresh hit so the drag will move just this
one." Replaces the imperative `legacyOnDown` shim.

`ViewportPhaseDef` intentionally does NOT include `pointerDown` — the
`Pick` derivation in `types.ts` lists only `wheel | keyDown | keyUp |
cursor | overlay | claimsAll`. Viewport tools have no body-hit
classifier need.

### Raw event parameter on `ActionFn` and continuations

`ActionFn<TScratch>` now accepts an optional second parameter — the
raw DOM event that triggered the route. Same for `BeginSpec`'s
`onMove` / `onRelease` / `onCancel`:

```ts
type ActionFn<TScratch> = (
  ctx: ToolCtx<TScratch>,
  event?: PointerEvent | KeyboardEvent | WheelEvent,
) => Result<TScratch>;

interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>, event?: PointerEvent) => void | Result<TScratch>;
}
```

The parameter is optional so existing route tables that take only
`ctx` continue to compile and behave identically. Authors opt in by
adding the second parameter when they need the raw event — typically
to forward to a consumer callback (e.g. `useSelectTool.onDoubleTap`'s
contract includes the `PointerEvent` for downstream coordinate work)
or to read `clientX`/`clientY` directly when `ctx.point` (world coords)
isn't the right space.

Continuation parameters narrow the type to `PointerEvent` — `onMove` /
`onRelease` / `onCancel` only ever fire on pointer events.

### Out of scope for Phase 4.5

- The legacy `drag` shim in `useSelectTool` around
  `useMove`/`useResize`/`useRotate` — Phase 5 Task 1 migrates it via
  the `beginAt` adapter pattern.
- Phase 3b resize/rotate affordance integration through the factory —
  unchanged from the original Phase 3 scope.

## Phase 6 follow-up: imperative `defineTool` removed; canonical location renamed (shipped 2026-05-12)

Phase 6 retired the imperative `defineTool` identity helper and promoted
the declarative factory to the canonical kit location.

### What moved

| Before | After |
|---|---|
| `src/tools/defineTool.ts` (imperative identity helper) | **deleted** |
| `src/tools/defineTool.test.ts` (imperative tests) | **deleted** |
| `src/tools/routing/defineTool.ts` (declarative factory) | `src/tools/defineTool.ts` |
| `src/tools/routing/defineTool.test.ts` | `src/tools/defineTool.test.ts` |
| `src/tools/routing/defineViewportTool.ts` | `src/tools/defineViewportTool.ts` |
| `src/tools/routing/result.ts` | `src/tools/result.ts` |
| `src/tools/routing/lookup.ts` | `src/tools/lookup.ts` |
| `src/tools/routing/modifiers.ts` | `src/tools/modifiers.ts` |
| `src/tools/routing/hitResult.ts` | `src/tools/hitResult.ts` |
| `src/tools/routing/types.ts` | `src/tools/routeTypes.ts` (renamed to disambiguate from `src/tools/types.ts` — the `Tool`/`ToolCtx` module) |
| `src/tools/routing/reflection/*` | unchanged |

### Public surface change

Before Phase 6:

```ts
import { defineTool, apply, mods, type ToolDef } from '@orochi235/weasel/routing';
```

After Phase 6:

```ts
import { defineTool, apply, mods, type ToolDef } from '@orochi235/weasel';
```

The `/routing` subpath is preserved, narrowed to reflection consumers:

```ts
import {
  buildActionRegistry, findConflicts,
  type RegistryEntry, type Conflict,
  type RouteResolvedInfo, formatRouteResolved,
  useToolDebugInfo, ToolDebugOverlay,
} from '@orochi235/weasel/routing';
```

### Rationale

1. **Imperative `defineTool` is dead weight at 0.3.0.** It was a
   19-line identity helper exclusively used to give TypeScript a
   hook for `TScratch` inference. With the declarative factory
   covering every shape the kit's built-in tools need (and after
   Phase 5b/5c, every built-in tool migrated), the imperative path
   served only as a parallel authoring surface for external
   consumers. No external consumer existed (Swillustrator, `weasel-*`
   packages, demo apps all confirmed via grep). At pre-1.0,
   soft-deprecation costs more than hard removal.
2. **`routing/` is for introspection, not authoring.** The folder
   name should match its contents. After the move, `routing/` houses
   reflection consumers (registry, conflicts, debug overlay) and
   nothing else. Authoring lives at the top of `src/tools/`
   alongside `useTools`, `dispatcher`, `useKeybindings` — the rest
   of the tool subsystem's surface.
3. **The dispatcher's JSDoc still uses the phrase "declarative
   routing".** That phrase describes a *behavior* (the factory
   translates route tables to dispatcher channels at translation
   time), not a folder. The phrase stays accurate after the file move.

### Migration note for external consumers

Anyone authoring tools via `@orochi235/weasel/routing` before Phase 6
changes their import line and otherwise their code is unaffected.
Behavior, types, and runtime contract are identical.
