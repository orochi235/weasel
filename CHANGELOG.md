# @orochi235/weasel

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
