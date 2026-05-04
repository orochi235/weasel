# @orochi235/weasel

## Unreleased

### Breaking

- `createReparentOp` arg names changed: `from` → `fromParentId`,
  `to` → `toParentId`. Update call sites accordingly.
- `View` now includes `scale: number` (default 1). `viewToTransform` now produces `{ panX: -view.x*scale, panY: -view.y*scale, zoom: scale }`.
- `RenderLayer.draw` signature is `(ctx, data, view) => void`. `runLayers` accepts an optional `view` (defaults to identity) and wraps world-space layers with `setTransform(scale, 0, 0, scale, -x*scale, -y*scale)`; screen-space layers get an identity transform.
- `SceneSlotConfig.drawOne` (and `DefaultLayersScene.drawOne`) signature is `(ctx, obj, pose, view) => void`.
- `handleHitRadius` is now interpreted in **screen pixels**: divided by `view.scale` at each hit-test site so the hit area matches the rendered handle size under zoom.
- `usePan` is removed. Use `useHandTool` for drag-pan and `useWheelPanTool` for wheel-pan.

### Added

- `LayoutStrategy<TPose>.contains?(containerPose, point)`: optional non-AABB
  containment predicate. `useMove`'s layout-pass hit-test consults it when
  present, falling back to an AABB check on the container's pose. Lets
  circular and irregular containers participate in drop-targeting without a
  rect-shaped pose.
- `createReparentOp` now defaults `coalesceKey` to `reparent:${id}` so
  successive reparents of the same id batch-merge cleanly. Default `label`
  is `'Reparent'`. Layout strategies can return reparent ops from
  `commitDrop` to express drop-driven parent reassignment.
- `tileGrid({ cellToPose })`: optional callback to map a cell rect + the
  dragged pose to the new pose. Default spreads `{x,y,width,height}` over
  the dragged pose (the existing rect-pose behavior). Override for
  point-only poses or other shapes. The `tileGrid<TPose>` signature is
  no longer constrained to `RectPose` — pass `cellToPose` whenever TPose
  doesn't carry the rect fields.
- `useMove` layout-pass picks the top-most container in z-order when the
  adapter implements `OrderedAdapter.getChildren`: walks the scene tree
  from the root via `getChildren(null)` (recursing into every visited
  node), accumulates each candidate with depth + sibling-index z-path,
  and picks deepest-then-latest-sibling. Adapters without `getChildren`
  retain the previous `getObjects()` iteration-order proxy. Adapters that
  implement `getChildren` only for explicit container nodes (not for
  `null`/root) are handled by a fallback that scans `getObjects()` for
  unvisited root-parented siblings after the recursive walk.
- Debug overlay subsystem: `?debug=…` URL gating + `<Canvas debug={...}>` prop.
  Six features ship: `hitboxes`, `handles`, `bounds`, `origins`, `snap`, `layers`.
  Sink threaded through `usePointerGestures`, `useResize`, `useRotate`,
  `useAreaSelect`, `useEditAnchors`, `useSelectTool`, and `gridSnapStrategy`.
  When the prop is omitted/false, every recording call short-circuits via
  optional chaining (tree-shakeable).
- New exports: `parseDebugFlags`, `createDebugSink`, `createDebugOverlayLayer`,
  `DEFAULT_DEBUG_THEME`, types `DebugConfig`, `DebugSink`, `DebugFeature`,
  `DebugTheme`, `HitShape`, `HandleKind`.
- `zoomAt(view, anchor, factor, opts?)` pure primitive shared by every zoom path.
- `useWheelZoomTool` (alwaysOn, claims wheel when `ctrlKey`/meta is held; anchors zoom at cursor).
- `useWheelPanTool` (alwaysOn, claims plain wheel; translates view by `delta / scale`).
- `useKeyboardZoomTool` (alwaysOn; `Cmd+=` / `Cmd+-` / `Cmd+0`; anchors at canvas center).
- Selection overlays, insert overlay, and area-select overlay run in `space: 'screen'` so chrome stays at fixed pixel size under zoom.
- `ZoomDemo` showcases the new tools and screen- vs world-pinned strokes.

## 0.1.0 - 2026-05-03 - Pre-Scene milestone

Pinned ahead of the `useScene` redesign (see `docs/proposals/useScene.md`) so the pre-Scene state is diffable. Highlights of the surface at this point:

- `<Canvas>` with explicit `adapter` prop, plus inline-props shorthand (`items`/`setItems`/`toPose`/`fromPose`/`createDefault`/...) that synthesizes an `arrayAdapter` for flat-list scenes.
- Move, resize, insert, area-select, rotate, clone, group (virtual + nested), text-edit, and selection-driven action hooks (escape, select-all, duplicate, nudge, delete, reorder, clipboard, undo/redo).
- Path poses as a first-class alternative to rect poses (`pathPoseDescriptor`, `composePath`, `polygonFromPoints`, `PathBuilder`, `pointInPath`, `traceToContext`).
- Text rendering with caret/selection theming, contenteditable in-place edit, glyph-position hit testing, `fitTextPose` autosize helper.
- `RotatedPose` extension and `useRotate` gesture; rotation handle on selection overlay.
- `UnitSystem` / `UnitValue` for customizable units.
- Grid overlay with cell-hover hook + highlight layer.
- Quadtree demo, compound-paths demo, bezier control-point editing demo.

Extracted from [garden](https://github.com/orochi235/garden) (`src/canvas-kit/`) as a standalone package on 2026-05-01.
