# Findings: ui.components.part8 (round 82)

## SwatchRings judges room with one ring depth list and lays a different one, so a later palette's lead ring can fold onto the ring before it
- where: packages/ui/src/components/SwatchGrid/SwatchRings.tsx:96 (SwatchRings useMemo) with packages/ui/src/components/SwatchGrid/ringPlan.ts:25 (viableRings), :55 (ringPlan), :67 (ringsOf)
- scenario: `viableRings` is judged on `ringThicknesses(rows, …)` (every row its own ring), then `ringPlan` collapses an earlier palette's rows and the rings are laid on `ringThicknesses(kept, …)`. A later palette's lead ring then sits at an index whose judged thickness was a plain swatch's. Palettes A (3 rows, no lead) and B (1 row, lead 3× a swatch's height) on a tight arc with room 3: kept is [2, 1], so B's ring is laid at depth ≈ 3s+2g where only 2s+2g (+clear) was checked. If that shift folds, `ringsOf` lays B on A's second ring and the two palettes' swatches are drawn over each other; if it doesn't fold, it still sits inside the `clear` margin the check exists to keep. The same fallback overlaps palettes whenever there are more palettes than room (`ringPlan` gives every palette one ring past `room`). It should judge the kept plan's own depths (or re-plan until they are viable).
- evidence: read (inference from the code path; not run)
- severity: medium

## Switch: an uncontrolled indeterminate switch held selected is turned off internally while `onChange` reports it on
- where: packages/ui/src/components/Switch/Switch.tsx:70 (onChange)
- scenario: `<Switch defaultSelected indeterminate onChange={…}>`: a click makes React Aria flip its own state to off; the wrapper reports `indeterminate || on` = `true` but never corrects React Aria's uncontrolled state. When the caller then clears `indeterminate` (it was told the switch is on), the switch draws and announces off. The correction is applied only to the report, so the uncontrolled path answers "what state is it in" two ways.
- evidence: read
- severity: low

## Shortcut search drops the plus key when it is written with spaces ("Cmd + +")
- where: packages/ui/src/components/ShortcutSheet/sheetRows.ts:30 (queryKeys)
- scenario: query `Cmd + +` splits to `['Cmd', '+', '+']`; every standalone `+` part is filtered out, so the wanted keys are just `cmd` and every Cmd shortcut matches instead of Cmd+Plus. The doc says `+` is the plus key "after another `+`", which this second `+` is; only the unspaced `Cmd++` works.
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

<!-- done: 3 findings, files read: 46 -->
