# @orochi235/weasel

## Unreleased

### Breaking

- `View` now includes `scale: number` (default 1). `viewToTransform` now produces `{ panX: -view.x*scale, panY: -view.y*scale, zoom: scale }`.
- `RenderLayer.draw` signature is `(ctx, data, view) => void`. `runLayers` accepts an optional `view` (defaults to identity) and wraps world-space layers with `setTransform(scale, 0, 0, scale, -x*scale, -y*scale)`; screen-space layers get an identity transform.
- `SceneSlotConfig.drawOne` (and `DefaultLayersScene.drawOne`) signature is `(ctx, obj, pose, view) => void`.
- `handleHitRadius` is now interpreted in **screen pixels**: divided by `view.scale` at each hit-test site so the hit area matches the rendered handle size under zoom.
- `usePan` is removed. Use `useHandTool` for drag-pan and `useWheelPanTool` for wheel-pan.

### Added

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
