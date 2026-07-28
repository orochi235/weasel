# Hooks

Reference for the React hooks `@weasel-js/core` exports. Type details and
option fields not covered here are in the source — every export carries JSDoc.

> **Interaction is not hooks anymore.** Move, resize, rotate, insert,
> area-select, clone, delete, duplicate, undo/redo and the rest are **action
> descriptors** registered into the Actions Registry, driven by **gesture
> bindings**. They are not hooks you call. See
> [Actions and bindings](#actions-and-bindings) below and
> [concepts.md](./concepts.md) for the model.
>
> What remains on this page is the genuine hook surface: state primitives
> (`useSelection`, `useTextEdit`), low-level drag primitives you build custom
> chrome on, and viewport/utility hooks.

## Actions and bindings

`<SceneCanvas>` mounts an `<ActionsProvider>` and a `<DepRegistryProvider>`,
then calls `useStandardActions` to register the kit-standard descriptors. A
descriptor declares *what* it does (`invoker.run`), *what it needs*
(`requires`, resolved from the dep registry at dispatch time), *when it's
allowed* (`eligible` / `enabled`), and *how it's reached by default*
(`defaultBinding`).

```ts
// packages/core/src/interactions/actions/defaults/delete.ts
export const deleteAction: Action & { requires: string[] } = {
  id: 'delete',
  label: 'Delete',
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: { timing: 'immediate', run: (deps) => { /* … */ } },
};
```

A tool reaches an action by binding a gesture spec to its id — that is all a
tool is:

```ts
bindings: [
  { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
  { spec: { kind: 'click', target: 'empty', mods: {} }, actionId: 'clearSelection' },
]
```

### The hooks that wire it up

| Hook / component | Purpose |
|---|---|
| `<ActionsProvider>` | Owns the registry. `<SceneCanvas>` mounts one (via `ActionsProviderIfRoot`) unless it's already nested inside one. |
| `useStandardActions(opts)` | Registers the 51 kit-standard descriptors and publishes `selection` / `view` / `scene` / `history` / `pointer` / `activeTool` as live dep sources. No-ops silently when either provider is absent. |
| `useActionsRegistry()` | The registry handle: `register(action)`, `trigger(id, params?)`, enumeration for palettes and toolbars. |
| `useAction(id)` | Subscribe to one action's live state (label, icon, `enabled`) for a button or menu item. |
| `evaluateEnabled(...)` | Resolve an action's `enabled` predicate against current deps. |
| `useKeybindings(...)` | Tool-activation and hold-to-engage hotkeys, folded into the parametric `tool.activate` / `tool.offhand` actions. Mounted by `<SceneCanvas>`. |
| `useGestureDispatcher(...)` | The input router `<SceneCanvas>` mounts. Reach for it only if you're building a custom canvas surface. |

Imperative callers (toolbar button, command palette) go through
`registry.trigger(id, params)`, which builds the deps the same way a gesture
would — so there is one code path, not two.

### Kit-standard actions

Registered by `useStandardActions`. "Default binding" is what the action
answers to with no tool involvement; actions with no default binding fire only
via a tool's `bindings` or a `trigger` call.

**Keyboard**

| Action id | Default binding |
|---|---|
| `escape` | Escape (channel `*`, phase `initial`) |
| `cancelGesture` | Escape (channel `*`, phase `engaged`) — aborts an in-flight gesture |
| `selectAll` | Mod+A |
| `delete` | Delete, Backspace (phase `initial`, so a mid-drag press is ignored) |
| `duplicate` | Mod+D |
| `group` / `ungroup` | Mod+G / Mod+Shift+G |
| `undo` / `redo` | Mod+Z / Mod+Shift+Z |
| `flip` | Shift+H (`axis: 'x'`), Shift+V (`axis: 'y'`) |
| `nudge.up` / `.down` / `.left` / `.right` | Arrow key (`magnitude: 'small'`), Shift+Arrow (`'big'`) |
| `reorder.forward` | Mod+] (`distance: 'adjacent'`), Mod+Alt+] (`'extreme'`) |
| `reorder.backward` | Mod+[ (`'adjacent'`), Mod+Alt+[ (`'extreme'`) |
| `exitPathEdit` | Escape |
| `deleteAnchors` | Delete, Backspace (phase `initial`) |
| `nudgeAnchors.<dir>` | Arrow / Shift+Arrow, as `nudge` |

Mod+Alt+bracket rather than Mod+Shift+bracket for the extreme reorders: Chrome
reserves Mod+Shift+bracket for tab switching. On macOS Option+bracket emits a
curly quote, so both codepoints are listed.

**Pointer / touch**

| Action id | Default binding |
|---|---|
| `move` | drag on `selected-body` |
| `resize`, `rotate`, `areaSelect`, `insert`, `clone`, `slice` | drag |
| `insert.adjustRotation` | drag |
| `lassoSelect` | drag, `shift` optional |
| `editAnchors` | drag whose press hit an anchor or control-handle affordance — higher specificity than a bare `drag`, so it wins over `move` without any opt-out |
| `marqueeAnchors` | drag on `empty` |
| `enterPathEdit` | double-click on a body |
| `selectAnchor` | click |
| `insertPathAnchor` | Alt+click |
| `cutPathAtAnchor` | Alt+Shift+click |
| `viewport.dragPan` | drag (cursor `grab`, `grabbing` while running) |
| `viewport.pinchZoom` | two-finger `multiTouch` |
| `ingest` | `drop` or `paste`, any modifiers |

**No default binding**

`clearSelection` (fires from `useSelectTool`'s empty-click binding),
`enterTextEdit` (from `useTextTool`'s binding), `align.left` / `.right` /
`.top` / `.bottom` / `.centerX` / `.centerY`, `distribute.horizontal` /
`.vertical`, `pathfinder.union` / `.subtract` / `.intersect` / `.exclude` /
`.divide` / `.crop`, `setFill`, `setStroke`, `setFillOpacity`,
`setStrokeOpacity` — all UI-driven.

`viewport.wheelPan` and `viewport.zoom` are deliberately **not** in the
standard set; `<SceneCanvas>` registers them conditionally from its
`viewport.pan` / `viewport.zoom` flags.

### Where the old hooks went

| Removed hook | Replacement |
|---|---|
| `useMove` | `move` action (`defaults/move.ts`); `UseMoveOptions` type survives |
| `useResize` | `resize` action; `UseResizeOptions`, `PoseDescriptor`, `RECT_POSE_DESCRIPTOR`, `cornerResizeHandles`, `hitCornerHandle` survive |
| `useRotate` | `rotate` action; `rotationHandle`, `hitRotationHandle`, `pointInRotatedRect`, `DEFAULT_ROTATION_HANDLE_DISTANCE` survive |
| `useInsert` | `insert` action; `UseInsertOptions` survives |
| `useAreaSelect` | `areaSelect` action (marquee is its built-in behavior, not opt-in) |
| `useClone` | `clone` action; `cloneByAltDrag()` behavior survives |
| `useEditAnchors` | `editAnchors` action, plus the `nudgeAnchors.*` / `deleteAnchors` / `marqueeAnchors` / `selectAnchor` / `cutPathAtAnchor` set; `hitAnchor`, `enumerateAnchors`, `withCoord` survive |
| `useEscape`, `useSelectAll`, `useDelete`, `useDuplicate`, `useNudge`, `useReorder`, `useGroup`, `useUngroup`, `useUndoRedo` | same-named actions in the table above |
| `useNest` / `useUnnest` | never shipped as hooks |
| `useClipboard` | `useClipboardOps` (logic only) + the `ingest` action for inbound payloads |
| `usePan` | `viewport.dragPan` / `viewport.wheelPan` actions |

Behaviors did not go away — `options.behaviors` moved onto the action's
binding opts. See [extending.md](./extending.md) for the behavior contract.

## State primitives

### `useSelection(options)`

Selection-state primitive. Returns `SelectionApi`: `{ current, get, set, add,
remove, toggle, clear, contains, applyClick, adapterMethods }`. Options:
`mode` (`single` | `multi`), `extend` (`shift` | `meta` | `ctrl`, default
`shift`), `initial`.
`packages/core/src/core/selection/useSelection.ts`.

Spread `selection.adapterMethods` into your adapter so actions read the same
selection state `<SceneCanvas>` does.

### `useTextEdit(options)`

In-place text editing via a contenteditable overlay positioned over a text
node's screen-space pose. Enter / blur commit; Shift+Enter inserts a newline;
Escape cancels.

Options: `container` (positioned ancestor for the overlay), `getText`,
`getStyle`, `getScreenPose` (called per frame while editing), `setText`
(caller wraps in op/undo), plus optional `getRuns` / `setRuns` for rich text —
when `getRuns` returns a non-empty array the overlay renders styled
`<span data-run>` elements instead of plain text. Returns `{ editingId,
startEdit(id, opts?), cancelEdit, commit, isEditing }`.

The text layer should hide the node it's editing
(`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.

### `useClipboardOps(options)`

Logic-only clipboard: `copy` / `cut` / `paste` over the adapter clipboard seam
(`snapshotSelection` / `commitPaste` / `getPasteOffset`), with a
`produceFlavors` / `jsonReplacer` outbound seam for OS-clipboard writes.
Binds no keys. Companion exports: `WEASEL_CLIPBOARD_MIME`,
`buildWeaselClipboardText`, `sniffWeaselClipboardText`,
`parseWeaselClipboardText`, `embedWeaselMetadataInSvg`,
`extractWeaselClipboardFromSvg`.

Inbound Cmd+V goes through the `ingest` action and the content-handler
registry, not through this hook.

### `useAlign(options)` / `useDistribute(options)`

Imperative align/distribute over a narrow adapter, for consumers driving them
from their own UI rather than through the `align.*` / `distribute.*` actions.
Useful exports: `alignDeltaFor`, `translatePoseViaDescriptor`.

## Drag primitives

Low-level building blocks for custom chrome and DOM-side gestures. These are
not routed by the dispatcher — you own the pointer events.

| Hook | Shape |
|---|---|
| `useDragGesture(opts)` | The base. Threshold-gated `idle` → `pending` → `active` lifecycle with per-gesture `scratch`; ctx carries both world and client coordinates. `onStart` / `onActivate` / `onMove` / `onEnd` / `onCancel`. |
| `useDragRect(opts)` | `useDragGesture` producing live `bounds` from start→current, with `minBounds` and an `isSubThreshold` flag on the end ctx. `setStart` / `setCurrent` let you override mid-gesture. |
| `useDragRadial(opts)` | `useDragGesture` producing `{ center, radius, rotation }`, with `minRadius`. |
| `useHandleDrag(opts)` | Returns `{ onPointerDown }` for a DOM/SVG handle; reports coordinates local to the handle's owning `<svg>` (or a `getRect` override). |
| `startThresholdDrag(e, opts)` | Not a hook — call it from a `pointerdown` handler. Captures the pointer, activates past `threshold` (default 4px), then `onMove` / `onCommit` / `onCancel`. Returns `{ isDragging() }`. |
| `useDragHandle()` / `useDropZone()` | DOM-level cross-surface drag with a typed `DragPayload` (`{ kind, ids, data }`) and a global drop-zone registry — for dragging between panels and the canvas. |

## Viewport and utility hooks

`<SceneCanvas>` doesn't own these; wire them in your component.

- `useCanvasSize(ref)` — observed CSS-pixel size.
- `useZoom({ ... })`, `useAutoCenter(...)` — viewport helpers.
- `useViewTween(...)`, `useViewAnimation(...)` — animated view changes
  (`animateToBounds` and friends).
- `useVelocityTracker()`, `useDecayLoop(config)` — inertial-pan building
  blocks.
- `usePinchGesture(...)` — raw two-finger pinch, below `viewport.pinchZoom`.
- `useGridCellHover(...)` — pointer→cell mapping.
- `usePointerStylus(...)` — pressure/tilt from `PointerEvent`.
- `useSceneAdapter(...)`, `useArrayAdapter(...)` — adapter construction.
- `useScene(...)` — the kit-owned scene tree. See
  [adapters.md](./adapters.md).

## Affordance factories

Reusable chrome primitives consumed by tools. See
[extending.md](./extending.md) for the composition pattern.

- `createCornerResizeAffordance(opts)` — four corner-handle hit zones for the
  active selection (single member) or union AABB (multi-mode).
  `packages/core/src/affordances/cornerResize.ts`.
- `createRotationAffordance(opts)` — circular handle above the bounds
  top-center. `packages/core/src/affordances/rotationHandle.ts`.
- `composeAffordanceLayer(id, label, [...affordances])` — bundle multiple
  affordances into a single `RenderLayer` whose `draw` iterates them and whose
  `hitTest` walks them top-down (last → first).
  `packages/core/src/affordances/composeAffordanceLayer.ts`.
</content>
</invoke>
