---
"@weasel-js/core": patch
---

Guide and alignment snapping reads its tolerance in screen pixels at every zoom,
through the camera of the view the drag landed in — a `<CanvasView>`'s own when the
drag started in one. `GestureContext` now carries that camera as `view` (`null` where
no view dep answers), refreshed each frame for move, resize, rotate and lasso-select
behaviors.

Breaking: the `getView` option is gone from `alignMoveBehavior`,
`alignInsertBehavior`, `alignResizeBehavior`, the move, resize and insert
`snapToGuides`, and `guideSnapStrategy`. Drop it; `tolerance` is always screen
pixels. Code that builds a `GestureContext` by hand must now supply `view`.
