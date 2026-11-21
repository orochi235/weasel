# Findings — ui.components.part8 (round 60, blind reviewer)

## ShortcutSheet draws a Ctrl+"+" shortcut as one "Ctrl++" chip and its search cannot find it
- where: packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx:39 (Row); packages/ui/src/components/ShortcutSheet/sheetRows.ts:25 (queryKeys)
- scenario: an action bound to `Mod++` (`{ key: '+', mods: { mod: true } }`, which `key('Mod++')` builds) on Windows/Linux, or with `apple={false}`. Row stringifies it with `formatShortcut` to `"Ctrl++"` and hands that string to `ShortcutKeys legend`, which reparses it through `keyLegendsFromFormatted`: `'Ctrl++'.split('+')` filtered of empties is `['Ctrl']` (length 1), so it falls to the glyph path and draws a single keycap reading `Ctrl++` instead of `Ctrl` and `+`. The search goes through the same parser, so typing the shortcut as shown (`Ctrl++`) yields the one key `ctrl++`, which is in no row's key set, and finds nothing; `Ctrl+Shift++` parses as just `ctrl, shift` and matches every Ctrl+Shift row. Row should pass the shortcut as data (`<ShortcutKeys shortcut={…}>`, the `formatShortcutParts` path) rather than round-trip through a string; the string round-trip also drops the leader steps' own keys (`partsFromLegend` gives leader labels only) and the `shift: 'optional'` chip that `formatShortcutParts` draws.
- evidence: read (formatShortcut.ts:69-72, keyLegendsFromFormatted.ts, ShortcutKeys.tsx:12-24)
- severity: low

## SidebarPanel with no `title` silently drops `onHide`, `actions`, `trailing`, `headerRef` and its fold control
- where: packages/ui/src/components/SidebarPanel/SidebarPanel.tsx:65 (SidebarPanel)
- scenario: `<SidebarPanel onHide={close} actions={<Menu/>} defaultCollapsed>` with `title` omitted (it is optional in `SidebarPanelProps`). The whole header row is gated on `title !== undefined`, so the close button the `onHide` doc promises ("when provided, the header gains a close button"), the `actions`/`trailing` controls and the `headerRef` target are never rendered; with `defaultCollapsed` or `collapsed` the body is unmounted and nothing on screen can unfold it. Either the header should render whenever any of its parts is given, or `title` should be required.
- evidence: read
- severity: low

## SpanStrips rounds the wrong row's bottom corners when it has no playhead
- where: packages/ui/src/components/SpanStrip/SpanStrip.module.css:121 (`.row:nth-last-child(2) > .strip`); packages/ui/src/components/SpanStrip/SpanStrips.tsx:83
- scenario: the last row is found as `:nth-last-child(2)` on the assumption that `.stackHead` is always the final child of `.rows`, but `SpanStrips` renders `.stackHead` only when `at !== undefined`. A stack given no `at` (documented: "Not given, there is none, and every strip plays to its end") with rows A, B, C rounds B's bottom corners and leaves C's (the stack's real bottom) square; a one-row stack gets no bottom rounding at all. Should key on the last `.row` (`:nth-last-child(1 of .row)` or a `data-last` attribute), not on a sibling count that changes with `at`.
- evidence: read
- severity: low

## rulerTicks has no bound on how many ticks it makes, and loops forever on a non-positive step
- where: packages/ui/src/components/SpanStrip/SpanStrips.tsx:39-42 (rulerTicks)
- scenario: when no step in `steps` spaces ticks 64 px apart it falls back to the largest step and still emits every tick across the window. A stack whose window grows past what its steps were chosen for (e.g. `steps: [5 * MIN, 10 * MIN]` from the story, on a 2-week window at 800 px) makes ~2,000 tick labels piled into the ruler, and `steps: [1000]` over a day makes 86,400 React children each render. A step of 0 as the fallback makes `t += step` never advance, and a negative one walks away from `win.to`: either way the `for` never ends and the render hangs. It should thin the fallback step to the spacing (or cap the count) and reject `step <= 0`. The loop also accumulates `t += step` instead of `first + i * step`, so a fractional step drifts and can drop the tick at `win.to`.
- evidence: read
- severity: low

## Switch reports a stale modifier set to `onChange` after a click that changed nothing
- where: packages/ui/src/components/Switch/Switch.tsx:51-58 (Switch)
- scenario: `mods` is written on every click capture but cleared only inside `onChange`. A click that toggles nothing (the switch `readOnly` or `disabled` through `HoldProps`, or React Aria refusing the press) leaves the click's keys in `mods`. Alt-click a read-only switch in a list that solos on Alt, lift the hold, then toggle it with Space: no click runs, so `onChange(on, mods.current)` hands back `alt: true` and the list solos instead of toggling one. The modifiers should be cleared after the click (or read only from a click in the same event turn), not left for the next change.
- evidence: read
- severity: low

## Switch does not mirror under right-to-left: its thumb sits and moves on physical sides
- where: packages/ui/src/components/Switch/Switch.module.css:46,55-57 (`.thumb`, `.switch[data-selected] .thumb`)
- scenario: in a `dir="rtl"` page the thumb is placed with `left: 1px` and moved on with `translateX(12px)`, so "off" is at the inline end and "on" at the inline start, the reverse of the reading direction, while the label (a flex row) does mirror and sits on the left. The kit mirrors its other directional chrome (`:dir(rtl)` rules in Tabs, Bar, ToolbarDock, ActionButton); this one needs `inset-inline-start` and a `:dir(rtl)` flip of the translate.
- evidence: read
- severity: low

## Sequence keys its cells by position, so a cell's live state moves to another step when the sweep changes
- where: packages/ui/src/components/Sequence/Sequence.tsx:46,52,55,71 (Sequence)
- scenario: the component promises "each cell is live, keeping its own state", but every `<li>`, row and column is keyed by its index. In the `Digits` story, open with `from: 0`, interact with the cell showing 5 (any stateful child: a toggled checkbox, an open disclosure), then set `from: 3`: the cell keyed 5 now shows 8 and still carries the state the user gave 5, and 5 itself now renders at index 2 wearing whatever state the user gave 2. Keying by the step (its `sweep.label(value)`, with the index only to break ties) keeps a step's state with that step.
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

<!-- done: 7 findings, files read: 46 -->
