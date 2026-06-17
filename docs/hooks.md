# Hooks

Reference for the gesture and action hooks. Type details and option fields
not covered here are in the source — every export carries JSDoc.

> Most consumers don't call the gesture hooks directly. `<Canvas>` owns
> `useMove`, `useResize`, `useRotate`, `useInsert`, `useAreaSelect`, and
> `useSelection` internally. Pass `moveOptions`, `resizeOptions`, etc. to
> configure them; pass `move={...}` to override the controller entirely.
>
> The action hooks (`useDelete`, `useDuplicate`, `useUndoRedo`, …) are not
> wired by `<Canvas>` — call them from your component.

## Gesture hooks

All gesture hooks return a controller of shape:

```ts
{
  start(...): void;
  move(...): boolean;
  end(): void;
  cancel(): void;
  isActive() | isResizing | isInserting | isCloning | ...
  overlay: <hook-specific overlay shape> | null;
}
```

Behaviors are passed via `options.behaviors` and run in array order. See
[extending.md](./extending.md) for the behavior contract.

### `useMove(adapter, options)`

Drag selected objects. Adapter: `MoveAdapter<TNode, TPose>` (`getNode`,
`getNodes`, `getPose`, `getParent`, `setPose`, `setParent`, optional
`applyBatch`, optional `findSnapTarget`, optional `getChildren`).

Options of note: `translatePose` (defaults to `translateRectPose` for poses
with top-level x/y), `behaviors` (`MoveBehavior<TPose>[]`),
`dragThresholdPx` (default 4), `expandIds` (group expansion),
`cascadeWorldPose` (children visually follow parent in overlay).

```ts
const move = useMove<Rect, Pose>(adapter, {
  behaviors: [snap(gridSnapStrategy<Pose>(20))],
});
```

Default ops: one `createTransformOp` per dragged id.

### `useResize(adapter, options)`

Resize from a corner anchor. Adapter: `ResizeAdapter<TNode, TPose>`.
Pose-shape-agnostic via `options.geometry: PoseDescriptor<TPose>` (defaults
to `RECT_POSE_DESCRIPTOR`).

Behaviors: `snapToGrid({ spacing })`, `clampMinSize({ minWidth, minHeight })`.

The overlay carries both `targetPose` (snapped/clamped) and `currentPose`
(lerped for visual smoothing). Render `currentPose`; commit ops use
`targetPose`.

### `useRotate(adapter, options)`

Rotate a single object via a handle above the AABB top-center. Adapter:
`RotateAdapter<TNode, TPose>`. Useful exports: `rotationHandle`,
`hitRotationHandle`, `pointInRotatedRect`, `DEFAULT_ROTATION_HANDLE_DISTANCE`.

`<Canvas>` enables this when the `selectionOverlay` config sets
`rotationHandle: true`.

### `useInsert(adapter, options)`

Drag-rectangle that mints a new object. Adapter: `InsertAdapter<TNode>` —
`commitInsert(bounds)` returns the new object or `null` to abort, plus
`insertNode`, `setSelection`, `getSelection`, the clipboard methods.

Options: `behaviors`, `minBounds` (strictly-greater thresholds; default
`{0,0}`), `posefromBounds` (override for non-rect TPose, e.g.
`(b) => rectPath(b)`).

`arrayAdapter`'s `createDefault` is the typical way to wire `commitInsert`.

### `useAreaSelect(adapter, options)`

Marquee selection. Adapter: `AreaSelectAdapter` — `hitTestArea(rect)`,
`getSelection`, `setSelection`, `applyOps`.

Default behavior is `selectFromMarquee()` (transient — selection change
isn't undoable). Pass `transient: false` to push a history entry.

### `useClone(adapter, options)`

Modifier-gated clone gesture. Adapter: `InsertAdapter<TNode>`. Options:
`behaviors: CloneBehavior[]` (kit ships `cloneByAltDrag()`), `setOverlay` /
`clearOverlay` (push-based — the hook calls these so the consumer renders
the ghost copy).

### `useSelection(options)`

Selection-state primitive. Returns `{ current, get, set, add, remove,
toggle, clear, contains, applyClick, adapterMethods }`. Options: `mode`
(`single` | `multi`), `extend` (`shift` | `meta` | `ctrl`, default
`shift`), `initial`. See `src/core/selection/useSelection.ts`.

Spread `selection.adapterMethods` into your adapter so action hooks read
the same selection state `<Canvas>` does.

### `useTextEdit(options)`

In-place text editing via a contenteditable overlay positioned over a text
node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
newline; Escape cancels.

Options: `container` (positioned ancestor for the overlay), `getText`,
`getStyle`, `getScreenPose` (called per frame while editing), `setText`
(caller wraps in op/undo). Returns `{ editingId, startEdit(id, opts?),
cancelEdit, commit, isEditing }`.

The text layer should hide the node it's editing
(`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.

## Action hooks

Selection-driven actions. Each takes a narrow adapter, an options object
(typically `{ bindKeyboard?: boolean }` or `{ enableKeyboard?: boolean }`),
and returns imperative trigger methods.

| Hook | Default keys | Trigger | Notes |
|---|---|---|---|
| `useEscape` | Escape (on by default) | `clearSelection()` | |
| `useSelectAll` | Mod+A (on by default) | `selectAll()` | Adapter: `getSelection`, `listAll`. |
| `useDelete` | Delete, Backspace (off by default) | `deleteSelection(): string[]` | Optional `filter(ids)` to protect locked objects. |
| `useDuplicate` | Mod+D (on by default) | `duplicate()` | Adapter implements `cloneNode(id, offset)`. Default offset `{8,8}`. |
| `useNudge` | Arrow keys (Shift = larger step, on by default) | `nudge(direction, large?)` | `step` default 1, `shiftStep` default 10. |
| `useReorder` | Mod+] / Mod+[ (forward/backward), Mod+Alt+] / Mod+Alt+[ (to-front/to-back, on by default) | `bringForward()` etc. | No-ops without `OrderedAdapter` methods. Mod+Alt avoids Chrome's reserved Mod+Shift+bracket tab-switch shortcut. |
| `useDelete` | (see above) | | Pairs with the action via `bindKeyboard`. |
| `useGroup` | Mod+G (off by default) | `group(): string \| null` | Adapter: `GroupActionAdapter`. Min selection size 2. |
| `useUngroup` | Mod+Shift+G (off by default) | `ungroup(): string[]` | |
| `useNest` | Mod+G (off by default) | `nest()` | Wraps the selection in a real parent node (nesting hierarchy, distinct from `useGroup`). |
| `useUnnest` | Mod+Shift+G (off by default) | `unnest()` | |
| `useUndoRedo` | Mod+Z / Mod+Shift+Z (off by default) | `undo()` / `redo()` | Adapter just needs `undo`/`redo` (+ optional `canUndo`/`canRedo`). |
| `useClipboard` | Mod+C / Mod+X / Mod+V (off by default) | `copy()` / `cut() / paste()` | Adapter: `ClipboardAdapter` extends `InsertAdapter`. |
| `useClipboardOps` | (none) | Logic-only variant of `useClipboard` without the keybinding wiring. |

Keybinding behavior: bindings ignore keystrokes targeting `<input>`,
`<textarea>`, or `[contenteditable]`, and ignore variants with extra
modifiers (so `Cmd+Backspace` for "go back" still works). See
`src/interactions/actions/useKeybinding.ts`.

## Affordance factories

Reusable chrome primitives consumed by tools. See `docs/extending.md` for the composition pattern.

- `createCornerResizeAffordance(opts)` — four corner-handle hit zones for the active selection (single member) or union AABB (multi-mode). `src/affordances/cornerResize.ts`.
- `createRotationAffordance(opts)` — circular handle above the bounds top-center for rotation. `src/affordances/rotationHandle.ts`.
- `composeAffordanceLayer(id, label, [...affordances])` — bundle multiple affordances into a single `RenderLayer` whose `draw` iterates them and whose `hitTest` walks them top-down (last → first). `src/affordances/composeAffordanceLayer.ts`.

## Other hooks (not gesture or action)

`<Canvas>` doesn't own these; wire them in your component.

- `usePan({ ... })`, `useZoom({ ... })`, `useAutoCenter(...)` — viewport.
- `useCanvasSize(ref)` — observed CSS-pixel size.
- `useFixedPixelRatio()` — DPR helper.
- `useGridCellHover(...)` — pointer→cell mapping.
- `useDragHandle()` / `useDropZone()` — DOM-level drag (cross-surface).
- `usePointerGestures(...)` — the router `<Canvas>` uses internally; reach
  for it only if you're building a custom canvas surface.
