# Declarative tool routing

Status: proposal. Captures the design exploration from 2026-05-12.
Decision pending; nothing in the kit changes until this lands as a spec.

## Driver

Today the kit's `Tool` type ships imperative gesture channels (`pointer`,
`drag`, `dblTap`, `keyboard`, `wheel`). Authors write handler bodies that
do their own hit-testing and branch on target kind. Result: every tool
that wants to handle "double-click on text → enter text edit" writes the
same hit-test + dispatch logic, and the kit can't introspect what a
tool *does* without running it.

The immediate need that surfaced this exploration: text-edit-on-dblclick
naturally belongs to multiple tools (select tool when active, text tool
when active, both per Illustrator/Figma convention). A single composable
piece of logic should drive both. The deeper question — whether the kit
should *encode* this composability into its tool grammar — is what this
proposal is about.

## Verb taxonomy

Borrowing the linguistic frame: tools are verbs.

- **Tools** (the unmarked default) act on an object — sometimes
  mandatory, sometimes optional. `useSelectTool` ("select the rect"),
  `useTextTool` ("insert here" / "edit that"), `useLassoTool` ("select
  these"), `useEditAnchorsTool` ("edit that anchor"). The target is
  part of the action's meaning. ~95% of the kit's tools fit here.
- **Viewport tools** never take an object. They operate on the
  viewport itself: `useHandTool`, `useWheelZoomTool`,
  `usePinchZoomTool`, `useKeyboardZoomTool`.

Conceptually the second class is "intransitive" verbs to the first
class's "transitive" — the term *viewport tool* is preferred at the
API surface because it's concrete and aligned with the kit's existing
vocabulary (`viewport` props, `View` transform). The kit's existing
`ambient` slot in the dispatcher is unrelated — it describes *when* a
tool fires (always-on vs. active-only), not what the tool acts on.
Many viewport tools happen to be registered in the ambient slot, but
the two concepts stay independent.

Tools (the default) fit a declarative `(gesture × target) → action`
routing model. Viewport tools don't — there's no target dimension to
route against, so they use handler-form channels instead.

## Phase shape

Most targeted tools are either:

- **Phase-free** — a click or dblTap fires an action and returns to
  rest. No "in-progress" state. (Select tool when not in a drag.)
- **Two-phase** — `idle ↔ active`. Some gestures start the active
  phase, some end it. Within active, scratch state holds the
  accumulator and continuation handlers drive the mid-gesture
  rendering.

Two-phase covers drag-gestures (resize, move, insert), modal flows
(pen mid-creation, text mid-edit), and any "begin → progress → commit"
shape. The kit ships exactly one phase distinction: the `active` slot
exists when `scratch !== null`. Authors don't name states.

Sub-phase nuance — e.g., pen tool's "hovering the first anchor about
to close" — lives in scratch fields, not as a distinct state.

## The factories

Two functions, both with one type parameter:

```ts
function defineTool<TScratch = void>(
  spec: ToolDef<TScratch>,
): Tool<TScratch>;

function defineViewportTool<TScratch = void>(
  spec: ViewportToolDef<TScratch>,
): Tool<TScratch>;
```

`defineViewportTool` is the restricted variant — its spec type omits
the routing-table fields that have no meaning without a target
(`click`, `dblTap` route tables) and accepts only handler-form
channels (`drag`, `wheel`, `keyDown`). Both produce the same
underlying `Tool<TScratch>` for the dispatcher; the split exists at
authoring time so the call site declares intent.

`TScratch` defaults to `void` so phase-free tools can't accidentally
call `begin(...)` — it'd be a type error. Authors opt into the active
phase by parameterizing.

No `TTargetKind` generic. The kit can't own a closed set of target
kinds because consumers register their own node kinds; making it
generic would force every `defineTool` call to declare its kinds union
without catching typos cross-file. Route table keys stay `string`.

No `TPose` / `TData` generics. Actions cast `ctx.target` at the call
site, matching the existing `adapter: unknown` convention.

## Action vocabulary

Five constructors. The dispatcher consumes the tagged results.

| Constructor | Effect |
|---|---|
| `apply(ops, label?)` | Dispatch ops through the adapter's `applyBatch`. No phase change. Used in phase-free routes. |
| `begin(spec)` | Open active phase. `spec` carries the initial scratch and optional continuation closures (`onMove`, `onUp`, `onCancel`). |
| `stay(newScratch)` | Update scratch within active. No commit. |
| `commit(ops, label?)` | Apply ops AND close active phase. |
| `cancel()` | Close active phase without applying ops. |

The route table value type:

```ts
type ActionFn<TScratch> = (ctx: ToolCtx<TScratch>) => Result<TScratch>;
type Result<TScratch> =
  | { kind: 'apply';  ops: Op[]; label?: string }
  | { kind: 'begin';  spec: BeginSpec<TScratch> }
  | { kind: 'stay';   scratch: TScratch }
  | { kind: 'commit'; ops: Op[]; label?: string }
  | { kind: 'cancel' }
  | { kind: 'claim' }   // suppress fall-through; no other effect
  | { kind: 'none' };   // pass to next slot
```

## Spec shape

```ts
interface ToolDef<TScratch = void> {
  id: string;
  presentation?: ToolPresentation<TScratch>;
  keybinding?: KeyBinding;
  initial: PhaseDef<TScratch>;
  active?: PhaseDef<TScratch>;  // omit for phase-free tools
}

interface PhaseDef<TScratch> {
  click?:   RouteTable<TScratch>;
  dblTap?:  RouteTable<TScratch>;
  drag?:    RouteTable<TScratch>;
  wheel?:   ActionFn<TScratch>;
  keyDown?: Record<string, ActionFn<TScratch>>;
  claimsAll?: boolean;
}

type RouteTable<TScratch> = Partial<Record<string, ActionFn<TScratch>>>;

// Viewport tools — restricted variant. Mechanically derived from
// ToolDef via Pick/Omit so any change to ToolDef ripples through and
// the subset relationship is compiler-enforced.
type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'claimsAll'
> & {
  // Narrows from `RouteTable<TScratch>` to just `ActionFn<TScratch>` —
  // valid because ActionFn is assignable to RouteTable | ActionFn.
  drag?: ActionFn<TScratch>;
};

type ViewportToolDef<TScratch = void> = Omit<
  ToolDef<TScratch>, 'initial' | 'active'
> & {
  initial: ViewportPhaseDef<TScratch>;
  active?: ViewportPhaseDef<TScratch>;
};
```

`ViewportToolDef` is a **strict structural subset** of `ToolDef`:
- No `click` or `dblTap` (those `PhaseDef` fields are dropped via `Pick`).
- `drag` is narrowed from `RouteTable | ActionFn` to just `ActionFn`.
- Everything else (id, presentation, keybinding, wheel, keyDown,
  claimsAll) is shared identically.

The relationship is enforced at the type level — `ViewportToolDef`
literally cannot diverge from `ToolDef` because it's derived from it.
Adding a new optional field to `PhaseDef` (e.g., a future `hover`
slot) automatically becomes available to viewport tools too if it's
included in the `Pick`; if it's omitted, viewport tools never see it.

The two factories share the same underlying `Tool<TScratch>` output —
the spec types only diverge at authoring time, giving each call site
the right autocomplete and catching typos like `click` on a viewport
tool at compile time.

## Modifier handling

Two equally-clean encodings. Pick one and commit:

```ts
// Function-form (flexible, less inspectable)
click: {
  'rect': (ctx) => ctx.modifiers.shift ? addToSelection(ctx) : select(ctx),
}

// Sub-table (declarative, inspectable)
click: {
  'rect': {
    default: select,
    shift:   addToSelection,
    alt:     cloneAndSelect,
  },
}
```

Sub-table form is preferred for declarative parity — but adds a layer
of nesting. Function form is the escape hatch. Spec should commit to
sub-table as the default with function form available; consumers can
pick per-route.

## Continuations

Drag-shaped gestures attach continuation handlers at `begin` time:

```ts
const beginMove: ActionFn = (ctx) => begin({
  scratch: { kind: 'move', startPoses: snapshotSelected(ctx) },
  onMove:  (ctx) => stay(previewMove(ctx.scratch, ctx.point)),
  onUp:    (ctx) => commit([moveOp(ctx.scratch)], 'Move'),
  onCancel: () => undefined,
});
```

The dispatcher routes `pointerMove` / `pointerUp` / `pointerCancel`
into these closures automatically when the tool is in active phase.

Click-sequence gestures (pen) don't attach continuations — each
subsequent click routes through `active.click` instead:

```ts
active: {
  click: {
    'anchor:first': (ctx) => commit([closePathOp(ctx.scratch.anchors)]),
    '*':            (ctx) => stay({ anchors: [...ctx.scratch.anchors, ctx.point] }),
  },
}
```

Same `begin/stay/commit/cancel` primitives, different usage shape:
"begin + auto-continuation" vs. "begin + dispatch-into-active." The
dispatcher unifies them.

## Sample tools

### Select (phase-free routing + drag-opens-phase)

```ts
const SelectTool = defineTool({
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
      'rect': beginMove,
      'text': beginMove,
      'path': beginMove,
      'empty': beginMarquee,
    },
  },
  active: {
    keyDown: { 'Escape': cancel },
  },
});
```

### Rect insert (pure drag-gesture)

```ts
const RectInsertTool = defineTool<{ start: Point; current: Point }>({
  id: 'insert-rect',
  presentation: { label: 'Rectangle', icon: <RectIcon />, group: 'shape', cursor: 'crosshair' },
  keybinding: { key: 'r' },
  initial: {
    drag: {
      'empty': (ctx) => begin({
        scratch: { start: ctx.point, current: ctx.point },
        onMove:  (ctx) => stay({ ...ctx.scratch, current: ctx.point }),
        onUp:    (ctx) => commit([createInsertOp(rectFromBounds(ctx.scratch))], 'Insert Rect'),
      }),
    },
  },
  active: {
    keyDown: { 'Escape': cancel },
    claimsAll: true,
  },
});
```

### Hand (viewport tool — drag pans the view)

```ts
const HandTool = defineViewportTool<{ startView: View; startPoint: Point }>({
  id: 'hand',
  presentation: { label: 'Hand', icon: <HandIcon />, group: 'view', cursor: 'grab' },
  keybinding: { key: 'h' },
  initial: {
    // No routing tables — viewport tools handle drags directly with a handler.
    drag: (ctx) => begin({
      scratch: { startView: ctx.view, startPoint: ctx.point },
      onMove: (ctx) => {
        ctx.setView({
          ...ctx.scratch.startView,
          x: ctx.scratch.startView.x + (ctx.point.x - ctx.scratch.startPoint.x),
          y: ctx.scratch.startView.y + (ctx.point.y - ctx.scratch.startPoint.y),
        });
        return stay(ctx.scratch);
      },
      onUp: cancel,  // view changes aren't undoable
    }),
  },
});
```

Reading `defineViewportTool` at the call site immediately signals the
intent: no targets, no routing — the tool acts on the viewport. The
`ViewportToolDef` spec type omits the routing-table fields entirely,
so a typo like `click: { 'rect': ... }` is a compile error rather than
a silently-dead route.

### Pen (multi-click path drawing)

```ts
const PenTool = defineTool<{ anchors: Point[] }>({
  id: 'pen',
  presentation: { label: 'Pen', icon: <PenIcon />, group: 'draw', cursor: 'crosshair' },
  keybinding: { key: 'p' },
  initial: {
    click: {
      'empty': (ctx) => begin({ scratch: { anchors: [ctx.point] } }),
    },
    dblTap: {
      'path': enterAnchorEdit,
    },
  },
  active: {
    click: {
      'anchor:first': (ctx) => commit([closePathOp(ctx.scratch.anchors)], 'Close path'),
      '*':            (ctx) => stay({ anchors: [...ctx.scratch.anchors, ctx.point] }),
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
  presentation: { label: 'Text', icon: <TextIcon />, group: 'type', cursor: 'text' },
  keybinding: { key: 't' },
  initial: {
    click: {
      'text':  enterTextEdit,                                          // existing → edit
      'empty': (ctx) => apply([insertTextOp({ point: ctx.point })],    // empty → insert
                              'Insert text'),
    },
    drag: {
      'empty': (ctx) => begin({                                        // drag empty → draw box
        scratch: { start: ctx.point, current: ctx.point },
        onMove: (ctx) => stay({ ...ctx.scratch, current: ctx.point }),
        onUp:   (ctx) => commit([createTextBoxOp(rectFromBounds(ctx.scratch))], 'Insert text box'),
      }),
    },
  },
  active: {
    keyDown: { 'Escape': cancel },
  },
});
```

`enterTextEdit` is the shared action — both `SelectTool` and
`TextTool` reference the same function. The composable piece.

## Reflection benefits (the framework promise)

Once every tool is data, the kit gets these for free — but they have
to be built or the data-shape is just ceremony:

- **Action registry.** Walk every tool's tables; every `ActionFn`
  with a stable identity becomes a registerable action that
  palettes/menus/keyboard shortcuts can fire by name.
- **Conflict detection at boot.** Two tools claiming the same
  `(slot × gesture × target × modifier)` is a static error the
  dispatcher can surface.
- **Tool-introspection debug overlay.** "You're in `active` phase of
  PenTool; valid gestures here: click→{anchor:first, *}, keyDown→{Escape, Enter}."
- **Documentation rendering.** Each tool's behavior is renderable
  as a table without inspecting source.
- **Visual tool editors.** Drag-and-drop actions onto phases (future).

If the kit ships the routing model but never builds at least 2-3
consumers of the reflection, the data shape is paying cost without
returning value. Commit to (a) the registry, (b) the conflict checker,
(c) the debug overlay before declaring victory.

## Open questions

- **Modifier encoding decision.** Sub-table vs. function-form. Probably
  ship both; declare sub-table the recommended default.

- **Target kind taxonomy.** Who owns the registry of valid target
  kinds? Probably the kit's `SceneCanvas` adapter, which already does
  hit-testing — it could publish a "what kinds can I produce?" surface
  consumed by tools at registration time.

- **`'*'` wildcard semantics.** Match any target including `'empty'`?
  Or any *non-empty* target? Spec needs to pick.

- **Drag-threshold semantics.** Today `useDragGesture` triggers a drag
  after N pixels of movement. The new model — does `drag` mean "any
  pointerdown that initiates a drag (after threshold)" or "any
  pointerdown, threshold-or-not"? Same primitive, different defaults.

- **Migration path.** Existing tools use the imperative channels.
  Approach: ship `defineTool` alongside the existing `Tool` shape;
  migrate built-ins one at a time; deprecate the imperative channels
  only when the migration is complete (or never — they're fine as an
  escape hatch).

- **3+ phase tools.** Not in scope. If a wizard-style tool needs
  `idle → drawing → previewing → committed → idle`, the design needs a
  `defineMultiPhaseTool` factory. Defer until a real case appears.

- **Cross-tool coordination.** A tool reading another tool's scratch.
  Rare; probably should route through the dispatcher's published-state
  surface rather than direct tool-to-tool access.

## What's not in scope

- The shape of `ToolPresentation` — already specified elsewhere.
- The icon set — already shipped.
- The Tool dispatcher's slot model (`active` / `hotkey` / `ambient`) —
  unchanged. The new factory still produces a `Tool<TScratch>` that
  registers in the existing slots.
- Hit-testing implementation. The kit's existing hit-test pipeline
  feeds `ctx.target` to actions; no changes there.

## Next steps if this is approved

1. Write a real spec under `docs/superpowers/specs/` decomposing this
   proposal into shippable phases.
2. Phase 1: ship `defineTool` factory + action constructors as an
   experimental import. Migrate one tool (probably `useSelectTool` or
   `useTextTool`) as the canonical example.
3. Phase 2: build the reflection consumers — registry, conflict
   checker, debug overlay. Until these exist, the routing model is
   ceremony.
4. Phase 3: migrate remaining built-in tools. Deprecate imperative
   channels (or keep them — see "Migration path" above).
5. Phase 4: document. Replace the existing tool-authoring guide with
   examples in the new shape.
