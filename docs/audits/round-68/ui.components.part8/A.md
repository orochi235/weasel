# Audit round 68 — ui.components.part8

## ShortcutSheet's key search takes a free-standing or trailing `+` as the plus key, so `Cmd + Z` and `Ctrl+` match nothing
- where: packages/ui/src/components/ShortcutSheet/sheetRows.ts:24 (queryKeys), via packages/ui/src/components/Keycaps/keyLegendsFromFormatted.ts:11
- scenario: the sheet's doc says a query is split "at spaces and `+`". Typing `Cmd + Z` splits at spaces into `Cmd`, `+`, `Z`. `keyLegendsFromFormatted('+')` gives the plus key, so `wanted` is `['cmd', '+', 'z']`, and no shortcut holds all three, so Undo is not found. Typing `Ctrl+` while on the way to `Ctrl+Z` is one part. `/\+(?=.)/` does not split at the trailing `+`, so the key becomes `ctrl+`. The list drops to "No matching shortcuts", although `Ctrl` alone listed every Ctrl shortcut a keystroke earlier. What should happen: a `+` standing alone as a joiner, or trailing mid-typing, separates keys, and only a `+` in key position (`Ctrl++`, a bare `+`) means the plus key.
- evidence: read
- severity: low

## A swatch whose `id` is `lead` or `empty` collides with a ring's lead or empty item in React's keys
- where: packages/ui/src/components/SwatchGrid/SwatchRings.tsx:135 and :158 (RingGroup's `swatch` and `extra`)
- scenario: on a curved `Along`, a `SwatchRingGroup` has a `lead` (a palette picker, say) and an option `{ id: 'lead', value: '#f00' }`. On ring 0, both the lead `<div key="lead">` and that `<SwatchButton key="lead">` are siblings in `Ring`'s children. React warns about the duplicate key and can reconcile the two as one, so the lead's state goes to the swatch or the other way round. The same happens with `empty`, and with an option id of `none-3` against the null swatch at index 3. What should happen: the extras' keys and the swatches' keys come from separate namespaces (for example, prefix the swatch keys), so no option id can collide with them.
- evidence: read
- severity: low

## `timed` says a span with no `start` follows the latest end on its tracks, but it follows the last span placed there
- where: packages/ui/src/components/SpanStrip/spanLayout.ts:57-67 (timed)
- scenario: one track holds spans A `{ ms: 10 }` (0–10), then B `{ start: 2, ms: 3 }` (2–5), then C `{ ms: 4 }`. `cursors.set(t, end)` overwrites the cursor with B's end of 5, not the larger 10, so C is placed at 5–9 on top of A. The function's doc ("following the latest end on the tracks it covers") promises 10–14. The field doc on `SpanStripSpan.start` ("where the span before it ends") promises 5. The two docs give different answers for the same input, and the code follows only one of them. Fix: keep `max(cursor, end)` per track, or change the function doc to say "the last-placed span's end".
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ScaleBar/ScaleBar.module.css
packages/ui/src/components/ScaleBar/ScaleBar.stories.tsx
packages/ui/src/components/ScaleBar/ScaleBar.tsx
packages/ui/src/components/Sequence/Sequence.module.css
packages/ui/src/components/Sequence/Sequence.stories.tsx
packages/ui/src/components/Sequence/Sequence.tsx
packages/ui/src/components/Sequence/index.ts
packages/ui/src/components/ShortcutSheet/ShortcutSheet.module.css
packages/ui/src/components/ShortcutSheet/ShortcutSheet.stories.tsx
packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
packages/ui/src/components/ShortcutSheet/sheetRows.ts
packages/ui/src/components/ShortcutSheet/shortcutSheetCommand.ts
packages/ui/src/components/Sidebar/Sidebar.module.css
packages/ui/src/components/Sidebar/Sidebar.stories.tsx
packages/ui/src/components/Sidebar/Sidebar.tsx
packages/ui/src/components/SidebarPanel/SidebarPanel.module.css
packages/ui/src/components/SidebarPanel/SidebarPanel.stories.tsx
packages/ui/src/components/SidebarPanel/SidebarPanel.tsx
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
packages/ui/src/components/Tabs/TabListAlong.tsx

<!-- done: 3 findings, files read: 38 -->
