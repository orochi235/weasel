# Audit round 68 — ui.components.part8

## A SpanStrip slider seeks on a right-click or middle-click press
- where: packages/ui/src/components/SpanStrip/useSpanSeek.ts:36 (useSpanSeek, onPointerDown)
- scenario: a seekable `SpanStrip` (`onSeek` given) gets a right-button press, e.g. to open the context menu. `onPointerDown` never checks `e.button`, so it captures the pointer and calls `onSeek(ms, true)`, and the release calls `onSeek(ms, false)`. The playhead jumps to wherever the context menu was opened. Middle-click and pen barrel buttons do the same. Only the primary button should seek; a slider ignores other buttons.
- evidence: read
- severity: low

## A second pointer pressed mid-drag resets where a cancel goes back to
- where: packages/ui/src/components/SpanStrip/useSpanSeek.ts:36-53 (useSpanSeek)
- scenario: on touch, finger one presses at t=10 s and drags the playhead to t=30 s, so the parent's `at` is now 30 s. Finger two then lands. `onPointerDown` runs again and sets `began.current = at`, which is 30 s, and re-seeks. If the gesture is then canceled, `onPointerCancel` sends 30 s back, not 10 s, where the press began. A move from either finger also seeks, so the playhead flips between the two. While `held`, a press from another `pointerId` should be ignored.
- evidence: read
- severity: low

## A `Sequence` grid caps each axis, not the cells: two open sweeps draw 65,536 live cells
- where: packages/ui/src/components/Sequence/Sequence.tsx:49-51 (Sequence)
- scenario: `<Sequence sweep={framesSweep({ loop: true }, { every: 10 })} across={framesSweep({}, { every: 10 })}>` — both sweeps are unbounded. `stepsOf(sweep, cap)` and `stepsOf(across, cap)` each stop at `SWEEP_CAP` (256), so the grid renders 256 × 256 = 65,536 `children()` cells, each a live component. That hangs the tab. The cap exists to bound what gets drawn, and the "Showing the first 256 steps" note implies about 256 things are shown. A grid needs a bound on rows × columns, or a cap per axis derived from one.
- evidence: read
- severity: medium

## A swatch whose id is `lead` or `empty` collides with the ring's lead or empty-state element key
- where: packages/ui/src/components/SwatchGrid/SwatchRings.tsx:135,158 (RingGroup)
- scenario: a palette on a curved `Along` has a lead (as `SwatchStrip` gives its palettes) and an option `{ id: 'lead', value: '#f00' }`. On ring 0, the lead's `<div key="lead">` and the swatch's `<SwatchButton key="lead">` are siblings in one `entries.map`, which gives React a duplicate key: a warning, and on a later reorder one element can be dropped or reused for the other. The swatch keys are caller ids, and the extras' keys share their namespace.
- evidence: read
- severity: low

## Two swatches of one color with no `id` get duplicate React keys
- where: packages/ui/src/components/SwatchGrid/SwatchGrid.tsx:120 (SwatchGridLine); packages/ui/src/components/SwatchGrid/SwatchRings.tsx:135 (RingGroup)
- scenario: `options` holds `#ffffffff` twice, as a user palette or a recent-colors list can. Both swatches are keyed `swatchId(o)`, which is the color, so React sees duplicate keys. It warns, and when the list changes it can keep the wrong swatch's DOM, focus and tab-stop state. The `id` doc only says to give one "where two swatches share a color" for selection identity, but no `id` makes rendering wrong too. Falling back to the index for a repeated id would avoid it.
- evidence: read
- severity: low

## `ScaleBar` given `lengths: []` renders a NaN label and width
- where: packages/ui/src/components/ScaleBar/ScaleBar.tsx:33 (ScaleBar)
- scenario: a host passes a filtered list that came out empty (`lengths={[]}`). `lengths ? { lengths } : {}` forwards the empty array, because `[]` is truthy. `scaleBar`'s `longestFitting([])` returns `undefined`, so `length` is `undefined`. The label reads "NaN…", and `--wzl-scale-bar-px` is `NaNpx`, an invalid width. The prop doc promises the 1-2-5 default when none is given, and an empty list should fall back to it the same way, or throw.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ScaleBar/ScaleBar.module.css
packages/ui/src/components/ScaleBar/ScaleBar.stories.tsx
packages/ui/src/components/ScaleBar/ScaleBar.tsx
packages/ui/src/components/ScaleBar/index.ts
packages/ui/src/components/Sequence/Sequence.module.css
packages/ui/src/components/Sequence/Sequence.stories.module.css
packages/ui/src/components/Sequence/Sequence.stories.tsx
packages/ui/src/components/Sequence/Sequence.tsx
packages/ui/src/components/Sequence/index.ts
packages/ui/src/components/ShortcutSheet/ShortcutSheet.module.css
packages/ui/src/components/ShortcutSheet/ShortcutSheet.stories.tsx
packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
packages/ui/src/components/ShortcutSheet/index.ts
packages/ui/src/components/ShortcutSheet/sheetRows.ts
packages/ui/src/components/ShortcutSheet/shortcutSheetCommand.ts
packages/ui/src/components/Sidebar/Sidebar.module.css
packages/ui/src/components/Sidebar/Sidebar.stories.module.css
packages/ui/src/components/Sidebar/Sidebar.stories.tsx
packages/ui/src/components/Sidebar/Sidebar.tsx
packages/ui/src/components/Sidebar/index.ts
packages/ui/src/components/SidebarPanel/SidebarPanel.module.css
packages/ui/src/components/SidebarPanel/SidebarPanel.stories.module.css
packages/ui/src/components/SidebarPanel/SidebarPanel.stories.tsx
packages/ui/src/components/SidebarPanel/SidebarPanel.tsx
packages/ui/src/components/SidebarPanel/index.ts
packages/ui/src/components/SpanStrip/SpanMarks.tsx
packages/ui/src/components/SpanStrip/SpanSegments.tsx
packages/ui/src/components/SpanStrip/SpanStrip.module.css
packages/ui/src/components/SpanStrip/SpanStrip.stories.tsx
packages/ui/src/components/SpanStrip/SpanStrip.tsx
packages/ui/src/components/SpanStrip/SpanStrips.tsx
packages/ui/src/components/SpanStrip/index.ts
packages/ui/src/components/SpanStrip/spanLayout.ts
packages/ui/src/components/SpanStrip/useSpanSeek.ts
packages/ui/src/components/SwatchGrid/SwatchButton.tsx
packages/ui/src/components/SwatchGrid/SwatchGrid.module.css
packages/ui/src/components/SwatchGrid/SwatchGrid.stories.tsx
packages/ui/src/components/SwatchGrid/SwatchGrid.tsx
packages/ui/src/components/SwatchGrid/SwatchRings.tsx
packages/ui/src/components/SwatchGrid/index.ts
packages/ui/src/components/SwatchGrid/ringPlan.ts
packages/ui/src/components/Switch/Switch.module.css
packages/ui/src/components/Switch/Switch.stories.tsx
packages/ui/src/components/Switch/Switch.tsx
packages/ui/src/components/Switch/index.ts
packages/ui/src/components/Tabs/TabListAlong.tsx

<!-- done: 6 findings, files read: 46 -->
