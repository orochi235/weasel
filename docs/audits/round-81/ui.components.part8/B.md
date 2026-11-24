## Forced colors leave an indeterminate Switch's track in an author color, not a system one
- where: packages/ui/src/components/Switch/Switch.module.css:59 (`.switch[data-indeterminate] .track`) against the `@media (forced-colors: active)` block
- scenario: `<Switch indeterminate />` (not selected) under Windows High Contrast. The track opts out with `forced-color-adjust: none`, and the media block's `.track { background: Canvas }` (0,1,0) loses to `.switch[data-indeterminate] .track` (0,3,0), so the track paints `color-mix(accent-strong 50%, transparent)` — an author color the user's contrast theme never chose — under a CanvasText thumb. The media block covers `[data-selected]` but has no `[data-indeterminate]` rule; it should repaint the mixed track in a system color (e.g. Canvas, or GrayText) like the other states.
- evidence: read
- severity: low

## SwatchGrid on a ring hangs or throws with `columns={0}`
- where: packages/ui/src/components/SwatchGrid/SwatchRings.tsx:88 (SwatchRings, `rowsKey`)
- scenario: a palette with `columns: 0` inside a curved `Along`. `Math.ceil(n / 0)` is `Infinity`, `Math.max(1, Infinity)` is `Infinity`, and `ringThicknesses` then calls `Array.from({ length: Infinity })`, which throws `RangeError: Invalid array length` (or tries to allocate 2^53−1 slots) during render. RingGroup's `k * columns` arithmetic would also collapse every swatch onto ring 0. Nothing validates `columns`; it should be held to at least 1 or rejected with a named error.
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

<!-- done: 2 findings, files read: 46 -->
