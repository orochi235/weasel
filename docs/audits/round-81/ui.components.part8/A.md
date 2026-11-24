## Switch's indeterminate state is not announced as mixed: `aria-checked="mixed"` is invalid on role `switch`
- where: packages/ui/src/components/Switch/Switch.tsx:43 (Switch, indeterminate effect)
- scenario: `<Switch indeterminate>` sets `aria-checked="mixed"` on React Aria's input, which carries `role="switch"` (useSwitch). ARIA 1.2 says `switch` does not support `mixed` and user agents treat it as `false`, so a screen reader announces "off" — not the "neither on nor off" the prop's doc promises. A mixed state needs a role that supports it (checkbox) or a description/valuetext saying so.
- evidence: read (Switch.tsx); React Aria's role=switch and the ARIA rule are from knowledge, not opened here
- severity: medium

## SidebarPanel header puts actions and the close button at the leading edge, spread apart, when there is no title
- where: packages/ui/src/components/SidebarPanel/SidebarPanel.tsx:73-90 (SidebarPanel header); SidebarPanel.module.css:13-19 (.titleRow)
- scenario: `<SidebarPanel actions={…} onHide={…}>` with no `title` and no fold. The title row is `justify-content: space-between` and depends on the flex-1 title box to push the rest to the end. With no title box, `actions` sits at the left edge and the close button at the right, with the empty space between them; with only `actions` (or only `onHide`), it sits at the left. The props doc says actions are "drawn in the header row at its trailing edge". Expected: every control packed at the trailing edge (e.g. `margin-inline-start: auto` on the first control, or an empty spacer standing in for the title).
- evidence: read
- severity: low

## Switch `indeterminate` with `isSelected` true: a click turns it off, not on as documented
- where: packages/ui/src/components/Switch/Switch.tsx:22 (SwitchProps.indeterminate), 55-66
- scenario: the doc says "a click turns it on". Nothing enforces that. The click goes to React Aria's toggle, which flips `isSelected`. A caller showing a mixed group as `isSelected` true plus `indeterminate` gets `onChange(false)` on the first click. (The CSS also draws both `data-selected` and `data-indeterminate` at once: the thumb at 6px but with the selected thumb's on-accent fill.) Expected: when `indeterminate`, a click reports `true` whatever `isSelected` holds.
- evidence: read
- severity: low

## useSpanSeek leaves its hold stuck when `onSeek` goes away mid-drag, and ignores every press after it comes back
- where: packages/ui/src/components/SpanStrip/useSpanSeek.ts:20-23, 41-45 (useSpanSeek)
- scenario: a press sets `held.current = pointerId`. If the parent drops `onSeek` before the pointer is released (e.g. seeking is disabled while playback starts), the hook returns `{}`. No pointerup or pointercancel handler is attached, so `held.current` is never cleared. Once `onSeek` is given again, `onPointerDown` returns early on `held.current !== null` for every later press, so the slider never seeks by pointer again until remount. Expected: clear `held` when `onSeek` is absent, or on `lostpointercapture`.
- evidence: read
- severity: low

## A span's `ink` is ignored on its unfilled label wherever the segment is open
- where: packages/ui/src/components/SpanStrip/SpanStrip.module.css:65 (`.strip > .segment[data-open]`); spanLayout.ts:22-23 (SpanStripSpan.ink doc)
- scenario: `ink` is documented as "Its label's color, filled or not". For every open segment (nothing after it on its stripe, the usual case for the last span), the unfilled copy's color is forced to `--wzl-fg`, so a caller's `ink: 'red'` shows only on the played part. The CSS comment states the intent, but the public prop doc contradicts it: one of the two is wrong.
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

<!-- done: 5 findings, files read: 46 -->
