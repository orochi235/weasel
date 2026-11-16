# Hooks

Reference for the React hooks `@weasel-js/core` exports. Type details and
option fields not covered here are in the source — every export carries JSDoc.

> **Interaction is not hooks.** Move, resize, rotate, insert,
> area-select, clone, delete, duplicate, undo/redo and the rest are **action
> descriptors** registered into the Actions Registry, driven by **gesture
> bindings**. See
> [Actions and bindings](#actions-and-bindings) below and
> [concepts.md](./concepts.md) for the model.
>
> The rest of this page is the hook surface: state primitives
> (`useSelection`, `useTextEdit`), low-level drag primitives you build custom
> chrome on, and viewport/utility hooks.

## Actions and bindings

`<SceneCanvas>` mounts an `<InputScope>`, an actions registry and a dep
registry of its own under whichever are in scope, then registers the standard
actions its `features` presets carry
(`FEATURE_ACTION_IDS` in `@weasel-js/core/named-features` lists core's) and the
kit actions its tools bind — only undo and redo on
a bare canvas, all of core's under `features={[drawPreset]}`. `useStandardActions`
does the same for a host of your own, taking any action list. A
descriptor declares *what* it does (`invoker.run`), *what it needs*
(`requires`, resolved from the dep registry at dispatch time), *when it's
allowed* (`eligible` / `enabled`), and *how it's reached by default*
(`defaultBinding`).

```ts
// packages/core/src/interactions/actions/defaults/delete.ts: what
// createDeleteAction() returns, and `deleteAction` is
{
  id: 'delete',
  label: 'Delete',
  icon: icon('delete'),
  group: 'edit',
  defaultBinding: [{
    spec: { kind: 'key', key: ['Delete', 'Backspace'], phase: BETWEEN_GESTURES },
    opts: { id: 'delete.key' },
  }],
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: { timing: 'immediate', run: (deps) => { /* … */ } },
  enabled: deleteEnabled,
}
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
| `<ActionsProvider>` | Owns a root registry. Every `<SceneCanvas>` mounts an `<InputScope>` under whichever registry is in scope, or a root of its own where there is none — see "Input scope and yoke" in `docs/taxonomy.md`. |
| `useStandardActions(opts)` | Registers the kit-standard descriptors and publishes `selection` / `view` / `scene` / `history` / `activeTool` as live dep sources. No-ops silently when either provider is absent. |
| `useActionsRegistry()` | The registry handle: `register(action)`, `trigger(id, params?)`, enumeration for palettes and toolbars. |
| `useAction(action)` | Register one `Action` descriptor for the lifetime of the calling component. No-ops when no `<ActionsProvider>` is in scope — with a dev-only warning, so a production build says nothing. |
| `evaluateEnabled(...)` | Resolve an action's `enabled` predicate against current deps. |
| `useKeybindings(...)` | Tool-activation hotkeys, as the parametric `tool.activate` action, and Escape back to the default tool, as `tool.resetToDefault`. Mounted by `<SceneCanvas>`. A tool's hold-to-engage `hotkey` becomes `tool.offhand`, registered with the tool rather than here. |
| `useGestureDispatcher(...)` | The input router `<SceneCanvas>` mounts. Reach for it only if you're building a custom canvas surface. |

Imperative callers (toolbar button, command palette) go through
`registry.trigger(id, params)`, which builds the deps the same way a gesture
would — so there is one code path, not two.

### Kit-standard actions

Registered by `useStandardActions`, and the path-edit, path-command and outline
actions by `@weasel-js/path-tools`' `pathsPreset` (marked *path-tools* below).
"Default binding" is what the action answers to with no tool involvement;
actions with no default binding fire only via a tool's `bindings` or a `trigger` call.

**Keyboard**

| Action id | Default binding |
|---|---|
| `escape` | Escape (channel `*`, phase `initial`) |
| `cancelGesture` | Escape (channel `*`, phase `engaged`) — aborts an in-flight gesture |
| `selectAll` | Mod+A |
| `delete` | Delete, Backspace (phase `initial`, so a mid-drag press is ignored) |
| `transformAgain` | Mod+D — repeats the last move, rotate, resize, or duplicate; duplicates when there is none |
| `duplicate` | Mod+Shift+D |
| `group` / `ungroup` | Mod+G / Mod+Shift+G |
| `undo` / `redo` | Mod+Z / Mod+Shift+Z |
| `clipboard.copy` / `clipboard.cut` | Mod+C / Mod+X; a paste arrives as a DOM `paste` event (`ingest`, `clipboard.pasteEvent` below) |
| `menu.context` | Shift+F10, ContextMenu |
| `flip` | Shift+H (`axis: 'x'`), Shift+V (`axis: 'y'`) |
| `nudge.up` / `.down` / `.left` / `.right` | Arrow key (`magnitude: 'small'`), Shift+Arrow (`'big'`) |
| `reorder.forward` | Mod+] (`distance: 'adjacent'`), Mod+Shift+] and Mod+Alt+] (`'extreme'`) |
| `reorder.backward` | Mod+[ (`'adjacent'`), Mod+Shift+[ and Mod+Alt+[ (`'extreme'`) |
| `createOutlines` (*path-tools*) | Mod+Enter |
| `joinPaths` (*path-tools*) | Mod+J; in path edit `joinAnchors` answers it |
| `averageAnchors` (*path-tools*) | Mod+Alt+Shift+J (`axis: 'both'`) |
| `exitPathEdit` (*path-tools*) | Escape; with a tool on other than the mode's `defaultTool` it returns to that tool instead (`returnToModeDefault`), so a second Escape leaves path edit. A mode shortcut's `exit` and `cancel` do the same |
| `deleteAnchors` (*path-tools*) | Delete, Backspace (phase `initial`) |
| `nudgeAnchors.<dir>` (*path-tools*) | Arrow / Shift+Arrow, as `nudge` |

Mod+Alt+bracket as well as Mod+Shift+bracket for the extreme reorders: some
browsers take Mod+Shift+bracket for tab switching before the page sees it. On
macOS Option+bracket emits a curly quote, so both codepoints are listed.

**Pointer / touch**

| Action id | Default binding |
|---|---|
| `move` | drag on `selected-body` |
| `editAnchors` (*path-tools*) | drag whose press hit an anchor or control-handle affordance; it ties `move` on specificity, and `move` turns those presses down, as it does a segment's or a path-tools poise grip's (`isPathEditPart`) |
| `bendSegment` (*path-tools*) | drag whose press hit the edited path's `segment` affordance, between anchors; `move` turns those down too |
| `marqueeAnchors` (*path-tools*) | drag on `empty` |
| `enterPathEdit` (*path-tools*) | double-click on a body |
| `editTextAt` | double-click on a body: opens the text node under the pointer (the `textEdit` feature) |
| `menu.context` | the `contextMenu` gesture |
| `selectAnchor` (*path-tools*) | click |
| `editEffectText` (*path-tools*) | click on a body: in path edit on a path an effect hides, a click on that effect opens its text, off the open path's anchors |
| `insertPathAnchor` (*path-tools*) | Alt+click |
| `cutPathAtAnchor` (*path-tools*) | Alt+Shift+click |
| `viewport.pinchZoom` | two-finger `multiTouch` |
| `ingest` | `drop` or `paste`, any modifiers |
| `clipboard.pasteEvent` | `paste` carrying `text/plain`, any modifiers — registered only where `ingest` is not |

**No default binding**

A plain drag carries no intent, so no action answers one by default. The tools
and contributions that want one bind it: `areaSelect` from the select tool (or,
under every tool, `areaSelectContribution()`), `insert` and
`insert.adjustRotation` from the shape tools, `lassoSelect` from the lasso tool,
`slice` from path-tools' slice tool, `viewport.dragPan` from the hand tool (or, on any
unclaimed drag, `dragPanContribution()`), and `resize`, `rotate` and `clone`
from the `resize`, `rotate` and `move` presets' selection contributions.

`clearSelection` (fires from `useSelectTool`'s empty-click binding),
`enterTextEdit` (from `useTextTool`'s binding), `align.left` / `.right` /
`.top` / `.bottom` / `.centerX` / `.centerY`, `distribute.horizontal` /
`.vertical`, `pathfinder.union` / `.subtract` / `.intersect` / `.exclude` /
`.divide` / `.crop`, `setFill`, `setStroke`, `setFillOpacity`,
`setStrokeOpacity`, `setStrokeWidth` (`width`, and per-anchor `vertexWidths`), `setVertexColor` (one anchor's `rgba` by `index`), `setAnchorField` — all UI-driven.

Path-edit actions such as fillets, poise grips, Sand, and Tug are
`@weasel-js/path-tools`', registered by its presets rather than by
`useStandardActions`; [path-operations.md](./path-operations.md) lists them with
their bindings.

The `align.*` actions take a `to` param and `flip` a `pivot` param naming what
the selection lines up against: `'union'` (the selection itself — align's
default), `'pointer'` (the click's world point, else the `pointer` dep's), a
world point or rect `{ x, y, width?, height? }`, or a key node `{ node: id }`.
Bind the pointer form to a key and the selection aligns or mirrors to wherever
the cursor is.

`viewport.wheelPan` and `viewport.zoom` are deliberately **not** in the
standard set; `<SceneCanvas>` registers them under the `view` preset, from its
`viewport.pan` / `viewport.zoom` flags.

An action's behaviors (`MoveBehavior`, `CloneBehavior`, …) go on its binding's
opts. See [extending.md](./extending.md) for the behavior contract.

## State primitives

### `useSelection(options)`

Selection-state primitive. Returns `SelectionApi`: `{ current, get, set, add,
remove, toggle, clear, contains, applyClick, intentOf, adapterMethods }`.
Options: `mode` (`single` | `multi`, default `single`); `extend`, the key that
adds or removes the pressed id (default Cmd on Apple platforms, Ctrl
elsewhere); `range`, the key that selects a run from the last pressed id
(default Shift), along `order` (default the scene's paint order); `initial`;
`scene`, a store to keep the selection on so every consumer of the scene shares
it and undo restores it; and `lock`, which makes every mutator a no-op.
`packages/core/src/core/selection/useSelection.ts`.

Spread `selection.adapterMethods` into your adapter so actions read the same
selection state `<SceneCanvas>` does.

### `useTextEdit(options)`

In-place text editing via a contenteditable overlay positioned over a text
node's screen-space pose. Enter / blur commit; Shift+Enter inserts a newline;
Escape cancels.

Options: `container` (positioned ancestor for the overlay), `getText`,
`getStyle`, `getScreenPose` (called per frame while editing), `setText`
(caller wraps in op/undo), optional `getClipRect` (the container-pixel box the
overlay is visible within; it clips without scrolling), plus optional
`getRuns` / `setRuns` for rich text —
when `getRuns` returns a non-empty array the overlay renders styled
`<span data-run>` elements instead of plain text. Returns `{ editingId,
startEdit(id, opts?), cancelEdit, commitEdit, isEditing }`.

Nothing is written until the edit commits. Pass `commit(id, { text, runs?,
style? })` in place of `setText` / `setRuns` / `setStyle` to take the whole
edit in one call and make it one undo step; `useSceneTextEdit` does. `style`
is there when the edit lowered a flag the node itself sets, and until the
commit the returned `nodeStyle` holds it.

The text layer should hide the node it's editing
(`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.

The hook owns whether an edit is open. State that follows it, an app's
editing mode for one, takes `onStart(id)` and `onEnd(id)`: each is called from
the call that opens or closes the edit, `onEnd` after any commit is written,
so the follower never renders out of step with it. `useSceneTextEdit` takes
the same pair.

`useSceneTextEdit(scene, container, options?)` wires those callbacks against a
scene. It projects through the view of the weasel canvas mounted inside
`container` and clips the overlay to that canvas's box, so a canvas that pans
or zooms needs no extra wiring; pass `options.view` only to use another camera.
Its `textAt(world)` names the topmost text node at a world point and the caret
at the glyph there. A node is text when `options.isText(data)` says so
(default: `data.text` is a string), and the returned `isTextNode(id)` asks the
same question by id. The two answer `TextEditDep.textAt` and
`TextEditDep.isTextNode`.

`<SceneCanvas>` mounts one of these itself, so a canvas needs no wiring for the
text and sticky tools to open an edit, nor, with the `textEdit` feature (part
of `edit`), for a double-click to: `editTextAt` is bound to it, opens what
`textAt` names, and declines where the double-click names a group, whose own
double-click enters it. Its `textEditor` prop takes the same options, or `false`
for none. It stands down for a host's own: a `useSceneTextEdit` whose container
holds the canvas, whose editor the canvas's `textEdit` dep then answers with,
so the host binds no handler of its own; or a `textEdit` dep registered by a
child (`@weasel-js/editor`'s `TextEditDepPublisher`), for a host whose container is elsewhere. A host
wires its own for character controls, which read the edit's `selection` and
styling.

### `useClipboardOps(adapter, options)`

Logic-only clipboard: `copy` / `paste` over the adapter clipboard seam
(`snapshotSelection` / `commitPaste` / `getPasteOffset`), with a
`produceFlavors` / `jsonReplacer` outbound seam for OS-clipboard writes.
A paste leaves out a node that derives from nodes that were not copied with
it; `onPasteOmitted` is told which and why (`PasteOmission`), and
`<SceneCanvas ingestion={{ clipboard: { onOmitted } }}>` is told the same for
a paste arriving from the OS clipboard.
Binds no keys. Companion exports: `WEASEL_CLIPBOARD_MIME`,
`buildWeaselClipboardText`, `sniffWeaselClipboardText`,
`parseWeaselClipboardText`, `embedWeaselMetadataInSvg`,
`extractWeaselClipboardFromSvg`.

Inbound Cmd+V arrives as a DOM `paste` event and does not go through this
hook. On a canvas with `ingest` it runs the `ingest` action and the
content-handler registry; on one with `edit` and no `ingest` it runs
`clipboard.pasteEvent`, which accepts only the node payload a copy writes.

### `useAlign(adapter, options?)` / `useDistribute(adapter, options?)`

Imperative align/distribute over a narrow adapter, for consumers driving them
from their own UI rather than through the `align.*` / `distribute.*` actions.
`align(edge, to?)` takes the same reference as the actions' `to` param.
Useful exports: `alignDeltaFor`, `alignTargetBounds`, `resolveSpatialReference`,
`translatePoseViaDescriptor`.

## Drag primitives

Low-level building blocks for custom chrome and DOM-side gestures. These are
not routed by the dispatcher — you own the pointer events.

| Hook | Shape |
|---|---|
| `useDragGesture(opts)` | The base. Threshold-gated `idle` → `pending` → `active` lifecycle with per-gesture `scratch`; ctx carries both world and client coordinates. `onStart` / `onActivate` / `onMove` / `onEnd` / `onCancel`. |
| `useDragRect(opts)` | `useDragGesture` producing live `bounds` from start→current, with `minBounds` and an `isSubThreshold` flag on the end ctx. `setStart` / `setCurrent` let you override mid-gesture. |
| `useDragRadial(opts)` | `useDragGesture` producing `{ center, radius, rotation }`, with `minRadius`. |
| `useHandleDrag(opts)` | Returns `{ onPointerDown }` for a DOM/SVG handle; reports coordinates local to the handle's owning `<svg>` (or a `getRect` override). |
| `startThresholdDrag(e, opts)` | Not a hook — call it from a `pointerdown` handler. Captures the pointer, activates past `threshold` (default 4px), then `onMove` / `onCommit` / `onCancel`. Returns `{ isDragging(), cancel() }`. |
| `useDragHandle()` / `useDropZone()` | DOM-level cross-surface drag with a typed `DragPayload` (`{ kind, ids, data }`) and a global drop-zone registry — for dragging between panels and the canvas. |

## Viewport and utility hooks

`<SceneCanvas>` doesn't own these; wire them in your component.

- `useCanvasSize(ref)` — observed CSS-pixel size.
- `useAutoCenter(...)` — viewport helpers.
- `computeWheelAction(view, input)` — the kit's wheel convention as a pure
  reducer over `View`: bare wheel pans, shift+wheel pans horizontally,
  Cmd/Ctrl+wheel zooms under the pointer. `wheelPan` / `wheelZoom` are its
  halves, and `viewport.wheelPan` / `viewport.zoom` are the wired form.
- `useViewAnimation(view, animator?)` — animated view changes, on the kit animator.
  `useViewAnimationOn(view, animator)` is the same on an animator you own, and
  builds none of its own. Its `viewTarget` is the view as an animation target:
  a shake run on it with that animator adds to the camera's own animation.
- `useVelocityTracker()`, `useDecayLoop()` — inertial-pan building
  blocks.
- `useGridCellHover(...)` — pointer→cell mapping (in `@weasel-js/guides`).
- `usePointerStylus(...)` — pressure/tilt from `PointerEvent`.
- `useSceneAdapter(...)` — the scene's adapter, for what sits outside the canvas.
- `useScene(...)` — the kit-owned scene tree. See
  [adapters.md](./adapters.md).

## Affordance factories

Reusable chrome primitives consumed by tools. See
[extending.md](./extending.md) for the composition pattern.

- `createCornerResizeAffordance(opts)` — a resize handle at each corner and,
  unless `edges: false`, each edge midpoint of the active selection (single
  member) or its union AABB (multi-mode).
  `packages/core/src/affordances/cornerResize.ts`.
- `createRotationAffordance(opts)` — an elliptical ring wrapping the
  selection's bounds; a drag from it rotates. `packages/core/src/affordances/rotationHandle.ts`.
- `composeAffordanceLayer(id, label, [...affordances])` — bundle multiple
  affordances into a single `RenderLayer` whose `draw` iterates them and whose
  `hitTest` walks them top-down (last → first).
  `packages/core/src/affordances/composeAffordanceLayer.ts`.
