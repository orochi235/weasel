# Audit round 58: ui.components.GradientEditor

## Removing a stop by dragging it off the track or right-clicking it leaves focus on a different handle than the stop the editor now shows
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:131 (onRemoveThumb)
- scenario: four stops at 0, 0.3, 0.6 and 1. Press the 0.3 handle (index 1); the press focuses it and selects it. Drag it off the track and let go. `onRemoveThumb` calls `removing(1)`, which moves the selection to the stop before it along the gradient (index 0). The Slider keys thumbs by index (`SliderBody.tsx:95`, `thumb-${i}`), so DOM focus stays on element 1, which now draws the 0.6 stop. Because focus never moved, `onFocus` never runs again. The row under the track edits stop 0 while the focused handle is the 0.6 stop, so arrow keys and Delete act on one stop and the editor shows another. The Delete-key path asks for `remove(index, true)` to refocus for exactly this reason; the pointer removals never do. If the removed stop was the last element, focus drops to the page instead. Expected: the pointer removals refocus the newly selected handle, as the key path does.
- evidence: read
- severity: medium

## A track-click add that the caller declines leaves the selection and a pending focus aimed at a stop that does not exist
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:126 (onAddThumb)
- scenario: `onAddThumb` runs `select(stops.length)`, which calls `onSelectionChange(n)` with an index one past the end, and sets `focusNext = { index: n, count: n + 1 }` before the caller has accepted the new stop. The caller may decline it: it validates, caps the stop count, or reports through `onChange` without writing the value back. In that case the selection stays out of range (it reads as the first stop, while a controlled caller now holds `selectedStop = n`), and `focusNext` stays armed. The next time the list reaches n + 1 stops by any route, such as an external edit or an undo, focus jumps into the track and selection lands on that stop. Expected: selection and focus move only once the added stop is in `value`.
- evidence: read
- severity: low

## Canceling a handle drag sends `onInput` a value rebuilt through toLocal(toScreen(...)), not the value the drag began from
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:88 (DragPoint onCancel)
- scenario: on cancel, `DragPoint` replays `onDrag(start.current, 'input')`, where `start.current` is the handle's screen point. `GradientHandles` turns that back into geometry with `toLocal`. Three things come back wrong. (1) Under a world transform far from the origin (center at 1e7), the round trip through screen pixels loses low bits, so the "restored" `from`/`center` is not the original. (2) A radial gradient whose radius was below `MIN_RADIUS` comes back as 1. (3) A conic angle outside (-π, π], such as 4 rad, comes back as `atan2`'s normalized angle. `docs/conventions.md` ("Edit callbacks") requires the value the edit began from, which is the `value` prop at the edit's start, so a caller previewing into its own state ends a canceled drag on a changed value. The replay also fires when the press never moved (press, then Escape), sending an `onInput` for an edit that sent nothing.
- evidence: read
- severity: medium

## The conic angle handle sits a fixed 50 gradient units from the center whatever the zoom, so it can land on top of the center handle or off screen
- where: packages/ui/src/components/GradientEditor/GradientHandles.tsx:131 (renderForKind, conic)
- scenario: for a conic, the arm length comes from `gradientGeometry(value).radius`, which is `conicArmRadius`: 50 for any non-`bounds` units. `GradientHandles` requires a resolved local or world frame, so the arm is always 50 local units. Under `toScreen` with a view zoomed to 5%, the tip is 2.5 px from the center. It is drawn after the center handle and covers it, so neither handle can be grabbed apart. At 2000% zoom the tip is 1000 px out, past the overlay's edge, and the angle cannot be reached. Expected: an arm with a fixed screen length, measured in overlay pixels.
- evidence: read
- severity: medium

## The radial guide is a screen circle, so under the anisotropic transform the comment plans for it does not trace the painted gradient
- where: packages/ui/src/components/GradientEditor/GradientHandles.tsx:103-109 (renderForKind, radial)
- scenario: the comment says the radius handle "stays on the drawn circle under a rotated or anisotropic transform". Take a node scaled 2× in x and 1× in y, where `toScreen` is that node's local-to-screen transform (the `units: 'local'` case the props describe). The painted gradient is an ellipse with semi-axes 2r and r on screen, but the guide is `<circle r={hypot(edge − center)}>` = 2r. The dashed guide shows a circle twice as tall as the gradient. Expected: the guide maps the circle through `toScreen`, as an ellipse or a sampled path.
- evidence: read
- severity: low

## Arrow keys on the radius or angle handle commit through `onChange` even when the step changed nothing
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:94 (DragPoint onKeyDown) with GradientHandles.tsx:120 and :149
- scenario: `onKeyDown` always sends `onDrag(next, 'commit')`. On a radial gradient already at `MIN_RADIUS`, pressing Left on the radius handle clamps back to 1 and still calls `onChange` with an unchanged paint. On a conic with angle 0, pressing Right moves the tip along the arm, and `atan2` gives 0 again, yet `onChange` fires. Each press records an undo step that does nothing. "Edit callbacks" says `onChange` fires "never for one that changed nothing".
- evidence: read
- severity: low

## Files read
packages/ui/src/components/GradientEditor/GradientEditor.module.css
packages/ui/src/components/GradientEditor/GradientEditor.stories.tsx
packages/ui/src/components/GradientEditor/GradientEditor.tsx
packages/ui/src/components/GradientEditor/GradientHandles.stories.module.css
packages/ui/src/components/GradientEditor/GradientHandles.stories.tsx
packages/ui/src/components/GradientEditor/GradientHandles.tsx
packages/ui/src/components/GradientEditor/GradientStops.module.css
packages/ui/src/components/GradientEditor/GradientStops.tsx
packages/ui/src/components/GradientEditor/StopEditor.tsx
packages/ui/src/components/GradientEditor/handleOverlay.module.css
packages/ui/src/components/GradientEditor/handleOverlay.tsx
packages/ui/src/components/GradientEditor/index.ts
packages/ui/src/components/GradientEditor/useStopSelection.ts

<!-- done: 6 findings, files read: 13 -->
