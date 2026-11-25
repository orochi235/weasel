## An uncontrolled indeterminate Switch reports "on" but is left drawn "off"
- where: packages/ui/src/components/Switch/Switch.tsx:74 (Switch, onChange)
- scenario: `<Switch defaultSelected indeterminate onChange={…}>`. A click makes React Aria flip its own uncontrolled state from true to false; `onChange` reports `indeterminate || on` = true, so the caller clears `indeterminate` thinking the switch is on. The switch then draws React Aria's internal state, which is off. The value reported and the value shown disagree. Only the controlled path is right, because there `isSelected` overrides the internal flip.
- evidence: read
- severity: low

## Two shortcuts that cannot be formatted collapse into one chip with an undefined key
- where: packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx:30 (distinctChips)
- scenario: `formatShortcutParts` returns `undefined` for a shortcut it cannot write (gestures/src/ui/formatShortcut.ts:53). `JSON.stringify(undefined)` is `undefined`, so the first such shortcut is kept with `id`/React `key` `undefined`, and every later one is dropped as a "duplicate". `keyNames` in sheetRows.ts handles the same `undefined` explicitly (`parts ? … : []`), so the two files answer the same case two different ways.
- evidence: read
- severity: low

## Spans with the same id collide as React keys in SpanStrip
- where: packages/ui/src/components/SpanStrip/SpanSegments.tsx:35 (SpanSegments, SpanPlayed), SpanMarks.tsx:17 (SpanSeams)
- scenario: two spans sharing an `id` (nothing in `SpanStripSpan` says ids must be unique; a run that repeats a step, such as two `fix` spans) are keyed by `p.span.id` alone. React warns and can reuse or drop one segment's DOM node, so its ref-set custom properties go to the wrong segment. Sequence (`stepKeys`) and SwatchGrid (`swatchKeys`) both disambiguate a repeated id by counting the earlier ones, so this is the same decision answered differently.
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
