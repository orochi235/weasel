# Findings: ui.components.part8 (round 60)

## ShortcutSheet keys a row's chips by formatted legend, which two distinct bindings can share
- where: packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx:38-41 (Row)
- scenario: an action bound to both `{ kind: 'key', key: 'a' }` and `{ kind: 'key', key: 'A' }` (a common way to answer with or without Caps Lock), or to `key: ' '` and `key: 'Space'`. `actionShortcuts` dedupes by the raw `key|mod|alt|shift` token, so both survive, but the legend upper-cases a one-character key and maps `' '`/`'Space'` to one glyph, so `formatShortcut` writes `A` (or `␣`) for both. The row draws the same chip twice under one React `key` (`key={legend}`): a duplicate-key warning, and on a rebind React may keep or drop the wrong element. Should show one chip per distinct legend (dedupe on the legend) or key by index.
- evidence: read (actionShortcuts.ts:69 token on the raw key; gestures/src/ui/keyLegendsFromMods.ts:139-140, 185 upper-casing and aliasing)
- severity: low

## SpanStrips without `at` rounds the second-to-last row's bottom corners, not the last row's
- where: packages/ui/src/components/SpanStrip/SpanStrip.module.css:121 (`.row:nth-last-child(2) > .strip`), with packages/ui/src/components/SpanStrip/SpanStrips.tsx:83
- scenario: the rule assumes `.rows` always ends with the `stackHead` span, so the last row is `nth-last-child(2)`. `SpanStrips` renders `stackHead` only when `at !== undefined`; `at` is optional ("Not given, there is none"). With `<SpanStrips rows={[a, b, c]} window={…} />`, row `c` is `:last-child` and row `b` is `nth-last-child(2)`: `b`'s strip gets the rounded bottom corners in the middle of the stack, and the stack's actual bottom (`c`) is square. With a single row and no `at`, that row gets no bottom rounding. Should target the last `.row` regardless of the head (e.g. `.row:not(:has(~ .row))`, or render the head first / always).
- evidence: read
- severity: low

## Files read
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
packages/ui/src/components/Tabs/TabRule.tsx

<!-- done: 2 findings, files read: 46 -->
