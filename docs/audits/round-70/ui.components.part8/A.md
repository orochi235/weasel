# Findings: ui.components.part8 (round 70)

## Ring arrow keys treat the last swatch of the previous ring (and the first of the next) as an along-the-ring neighbor, so Left/Right can jump across the whole arc
- where: packages/ui/src/components/SwatchGrid/SwatchRings.tsx:205 (ringStep)
- scenario: a SwatchGrid inside a curved `Along` (say a bottom arc, 90° wide) with two rows, `columns` 6. Focus swatch 6, the first swatch of ring 1, at the arc's left end. ArrowRight: the candidates are `i + 1` (swatch 7, the next along ring 1, its direction tangent to the arc's end, about 45° below horizontal, align ≈ 0.71) and `i - 1` (swatch 5, the *last* swatch of ring 0 at the arc's far right end, almost exactly to the right, align ≈ 0.99). `ringStep` takes swatch 5, so focus leaps across the whole palette to the other end of the outer ring rather than moving one step along ring 1. ArrowLeft from the last swatch of ring k jumps the same way to the first swatch of ring k + 1. `i ± 1` is only an along-ring neighbor when both lie on the same ring (`Math.floor(j / columns) === Math.floor(i / columns)`, or the shared last ring); across a ring boundary it should not be a candidate. The doc comment promises "neighbors along the ring or on the next ring in or out".
- evidence: read (geometry reasoned from the candidate list; not run)
- severity: medium

## An arrow key on a seekable SpanStrip whose `at` lies past the window steps from the off-window value, so the first presses do nothing visible
- where: packages/ui/src/components/SpanStrip/useSpanSeek.ts:32 (onKeyDown)
- scenario: `<SpanStrip window={{ from: 0, to: 60_000 }} at={90_000} onSeek={…}>` (a clock running past the window shown). The strip draws the playhead clamped at the end (`atFraction` clamps) and reports `aria-valuenow` 60000. ArrowLeft computes `to = 90_000 - 0.01 * 60_000 = 89_400`, which is clamped to 60_000, so `onSeek(60_000)` is sent and the playhead stays put; the user must press until the unclamped value crosses the window. The step should start from the clamped value the slider shows and announces (`Math.min(win.to, Math.max(win.from, at))`, as `aria-valuenow` already does). Same for `at` before `win.from` with ArrowRight.
- evidence: read
- severity: low

## Switch reports stale modifier keys on a keyboard toggle after a click that did not toggle
- where: packages/ui/src/components/Switch/Switch.tsx:61 (onClickCapture / onChange)
- scenario: a read-only (held) Switch is Alt-clicked: `onClickCapture` stores `{ alt: true }` in `mods`, but React Aria refuses the change, so `onChange` never runs and `mods` is never reset. The hold lifts and the user presses Space: React Aria calls `onChange(on)` with no click, and the switch hands the consumer `mods.current`, still `{ alt: true }`, so a list of switches "solos on Alt" for a plain keyboard toggle. The capture should be cleared when the click does not lead to a change (for example reset in a bubbling `onClick` after React Aria's handler, or read the modifiers only for the click that triggers the change).
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
