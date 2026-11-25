# Audit round 58 — ui.components.GradientEditor

## A canceled handle drag sends onInput a recomputed value, not the value the drag began from
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:88 (DragPoint onCancel), with GradientHandles.tsx:120-124 and 149-153
- scenario: the cancel path calls `onDrag(start.current, 'input')`, so the value it sends is rebuilt from the handle's *screen* position through the kind's drag math, not read back from the value at press. (a) A conic gradient with `angle: 3π/2` (or any angle outside (-π, π]): press the angle handle, press Escape → onInput gets `angle: -π/2` from `atan2`, a different stored value. (b) A radial gradient with `radius: 0.4` (a small local frame): cancel → onInput gets `radius: 1` from the `MIN_RADIUS` clamp. (c) Any handle far from the origin, or under a non-trivial view: `toLocal(toScreen(p))` does not round-trip exactly, so the "restored" point is off by rounding error. docs/conventions.md "Edit callbacks" says a canceled control sends onInput "the value the edit began from"; a caller previewing into its own state is left with a changed value and no commit, so the change escapes undo.
- evidence: read
- severity: medium

## The radius floor is 1 gradient unit, whatever the gradient's units are
- where: packages/ui/src/components/GradientEditor/GradientHandles.tsx:123,160 (renderForKind, MIN_RADIUS)
- scenario: `MIN_RADIUS = 1` is a length in the gradient's own frame, which the props say is local or world units of arbitrary scale. A radial gradient on a node 0.5 units across (a scene in meters, an icon in a 0..1 frame resolved by `paintToLocalUnits` on a small box): any drag of the radius handle writes `radius ≥ 1`, larger than the shape, so the radius can never be dragged down to fit it. The floor only needs to keep the radius off zero; a scale-free epsilon (or one derived from a screen pixel through `toLocal`) would.
- evidence: read
- severity: medium

## A commit-only GradientEditor does not show a stop drag or a color drag on its track
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:91-96,123,150 (GradientStops)
- scenario: `<GradientEditor value={g} onChange={set} />` with no `onInput`. Dragging a stop: Slider gets `onInput` undefined and draws its own thumb draft, but `paintTrack` samples `value.stops`, so the ramp under the thumb stays the old gradient until release, and the stop editor's position field does not move. Dragging the selected stop's color: `onColorInput` calls `onInput?.()`, a no-op, so the handle face and track keep the old color while the ColorField shows the new one. "Edit callbacks" says a control given no onInput "draws the edit in progress itself"; GradientHandles does this through `useEditDraft`, GradientStops/GradientEditor do not.
- evidence: read
- severity: medium

## Removing a stop by dragging it off the track or by right-click leaves focus on a different stop than the selection
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:131-135 (onRemoveThumb), with useStopSelection.ts:38-45
- scenario: Slider keys thumbs by index (`thumb-${i}`, SliderBody.tsx) and focuses a thumb on press. Stops `[0, 0.5, 0.8, 1]`; press stop 1 (focused, selected) and drag it off the track. `removing(1)` moves the selection to stop 0, but focus stays on the DOM thumb at index 1, which now draws the stop at 0.8; no focus event fires, so nothing reconciles them. Arrow keys now move the 0.8 stop while the editor row and the selected ring are on stop 0, and Delete removes the 0.8 stop rather than the one shown as selected. Dragging off the last-index stop unmounts the focused thumb and drops focus to the page. The same follows from a right-click removal (`onThumbContextMenu`) of a stop before the focused one. Only the Delete-key path sets `focusNext`.
- evidence: read
- severity: medium

## A focus request that the consumer never satisfies stays pending and steals focus later
- where: packages/ui/src/components/GradientEditor/GradientStops.tsx:61-67,79,128 (focusNext effect)
- scenario: `focusNext` is cleared only when `stops.length` reaches the expected count. A consumer that rejects an edit (caps the stop count, or validates and drops the change) leaves the request armed. Three stops, consumer caps at three: a track click arms `{ index: 3, count: 4 }`, the value stays at three. Much later an unrelated edit (an undo elsewhere, an external update) makes the list four long, and the next render focuses handle 3, pulling focus away from wherever the user is. Same with a Delete the consumer refuses, which waits for the list to shrink.
- evidence: read
- severity: low

## An out-of-range selection is never written back, so it comes back when the list grows
- where: packages/ui/src/components/GradientEditor/useStopSelection.ts:29-36 (useStopSelection select)
- scenario: `selected` falls back to `order[0]` when the held index names no stop, but `select` returns early when `index === selected`, so choosing the fallback stop never replaces the stale index. A track-click add whose commit the consumer does not apply leaves `own` (or the controlled `selectedStop`, via onSelectionChange) at `stops.length`. The user then focuses the first stop: the early return leaves `own`/the parent's value at the stale index. When a stop is later added by any route, the selection jumps to it instead of staying on the stop the user picked. A controlled caller passing an out-of-range `selectedStop` also never hears `onSelectionChange` for a press on the first stop.
- evidence: read
- severity: low

## Up and Down on the radial radius handle both grow the radius
- where: packages/ui/src/components/GradientEditor/handleOverlay.tsx:94-101 (DragPoint onKeyDown), GradientHandles.tsx:120-124
- scenario: the arrow step moves the radius handle 1 px in screen space, and the radius is re-read as the distance from the center. The handle sits on the center's +x axis, so Up or Down moves it perpendicular to the radius: both give `hypot(r, 1px)` > r, a small growth either way, and neither shrinks it. Left and Right (in an unrotated view) are the only keys that act like a radius control, and once Left carries the handle past the center the radius starts growing again. A keyboard user cannot tell which keys work, and `aria-keyshortcuts` advertises all four.
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

<!-- done: 7 findings, files read: 13 -->
