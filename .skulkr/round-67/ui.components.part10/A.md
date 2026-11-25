## useTimelinePlayback reads any numeric loop (0 or a finite pass count) as looping forever, so a finished timeline reports playing and its frame loop never stops
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:11 (isAdvancing)
- scenario: a handle with `loop: 3` (three passes, `lapsOf` in packages/animator/src/timeline/playhead.ts:8) or `loop: 0` (one pass, no loop) plays to its end unpaused. `handle.loop() !== false` is true, so `isAdvancing` returns true: the Transport shows Pause though nothing moves, and the `useVisibleRaf` loop re-requests a frame and re-renders every frame indefinitely. It should count as advancing only while laps remain (or `loop === true`). The same file's `Transport` reads `0` as off (`looping = loop !== false && loop !== 0`, Transport.tsx:119), so the two answer "is 0 a loop" differently.
- evidence: read
- severity: medium

## isAdvancing ignores the loop policy when playing in reverse
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:10 (isAdvancing)
- scenario: a looping timeline run backward whose playhead sits at 0 (resumed at 0 from elsewhere, e.g. `handle.resume()` by another control rather than the Transport's play button, which seeks to the end first) reads as not advancing: `playing` false and no frame requested, though the animator wraps it and plays on. The forward branch consults `loop()`; the reverse branch does not — the same question answered two ways by direction.
- evidence: read
- severity: low

## ToolPalette marks a dimmed (mode-ineligible) tool as a carry source though it cannot carry
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:142-144 (button)
- scenario: `carryTool` returns a payload for a tool the current mode disallows with `ineligible="dim"`. `onPointerDown` is withheld (`carryTool && enabled`), but `className` still gets `s.carrySource` from `carryTool?.(tool) != null` with no `enabled` check, so the disabled button keeps the carry-source styling (grab affordance) while a press does nothing. The two fields decide "is this a carry source" differently.
- evidence: read
- severity: low

## Tooltip parses each string child as separate markdown, so markup spanning an interpolation is not rendered
- where: packages/ui/src/components/Tooltip/Tooltip.tsx:118-120 (Tooltip)
- scenario: `<Tooltip>Sets **{name}** on every stop</Tooltip>` gives React three children ("Sets **", name, "** on every stop"); `Children.map` hands each to its own `InlineMarkdown`, so the `**` pair never matches and the literal asterisks show. The doc says "a string is read as inline markdown", which a caller reads as the tooltip's text; adjacent string children should be joined before parsing.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ToolPalette/ToolPalette.stories.tsx
packages/ui/src/components/ToolPalette/ToolPalette.tsx
packages/ui/src/components/ToolPalette/index.ts
packages/ui/src/components/ToolPalette/order.ts
packages/ui/src/components/ToolPalette/stacks.ts
packages/ui/src/components/ToolPalette/useToolCarry.tsx
packages/ui/src/components/ToolRail/RailStack.tsx
packages/ui/src/components/ToolRail/ToolRail.module.css
packages/ui/src/components/ToolRail/ToolRail.stories.tsx
packages/ui/src/components/ToolRail/ToolRail.tsx
packages/ui/src/components/ToolRail/index.ts
packages/ui/src/components/ToolRail/items.ts
packages/ui/src/components/Tooltip/Focusable.tsx
packages/ui/src/components/Tooltip/Tooltip.module.css
packages/ui/src/components/Tooltip/Tooltip.stories.tsx
packages/ui/src/components/Tooltip/Tooltip.tsx
packages/ui/src/components/Tooltip/buttonTooltip.tsx
packages/ui/src/components/Tooltip/index.ts
packages/ui/src/components/Transport/AnimatedTransport.tsx
packages/ui/src/components/Transport/Transport.module.css
packages/ui/src/components/Transport/Transport.stories.module.css
packages/ui/src/components/Transport/Transport.stories.tsx
packages/ui/src/components/Transport/Transport.tsx
packages/ui/src/components/Transport/index.ts
packages/ui/src/components/Transport/timeText.ts
packages/ui/src/components/Transport/timelineHandle.fixtures.ts
packages/ui/src/components/Transport/useTimelinePlayback.ts
packages/ui/src/components/ZoomControl/ZoomControl.module.css
packages/ui/src/components/ZoomControl/ZoomControl.stories.tsx
packages/ui/src/components/ZoomControl/ZoomControl.tsx
packages/ui/src/components/ZoomControl/index.ts
packages/ui/src/components/appearance.ts
packages/ui/src/components/appearanceIcons.ts
packages/ui/src/components/checker.module.css
packages/ui/src/components/heldItem.ts
packages/ui/src/components/listOption.ts
packages/ui/src/components/toggleLabel.module.css
packages/ui/src/components/toggleModifiers.ts

<!-- done: 4 findings, files read: 38 -->
