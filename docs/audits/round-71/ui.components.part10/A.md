# Audit round 71 — ui.components.part10 (blind reviewer)

## A canceled timeline reads as playing forever, and its transport renders every frame for as long as it is mounted
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:8 (isAdvancing), with the loop at :25-33
- scenario: `<AnimatedTransport handle={h}>` while `h` plays (time < duration, or `loop: true`); something cancels `h` (`h.cancel()`, `cancelAll`, a cancel key). `createTimeline`'s `onCancel` retires the entry, and after that `entry.isPaused()` returns `wantPaused` (packages/animator/src/timeline/entry.ts:67), which stays `false` for a timeline that was playing. `time()` stays frozen below `duration()` (or `loop()` stays `true`), so `isAdvancing` stays true. The rAF callback calls `bump()` and `raf.request()` every frame without end, re-rendering the transport about 60 times a second for a playhead that never moves. Meanwhile the play button shows "Pause" for a dead timeline. What should happen: a canceled handle reads as not advancing, so the loop stops and the button shows Play. `TimelineHandle` exposes no canceled state (types.ts has no `isCanceled`), so the hook cannot tell the difference today. The fix needs either that state on the handle or `isPaused()` reporting true once canceled.
- evidence: read (entry.ts retire/isPaused, createTimeline.ts onCancel, useTimelinePlayback.ts isAdvancing)
- severity: medium

## Files read
packages/ui/src/components/ToolPalette/ToolPalette.stories.module.css
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

<!-- done: 1 findings, files read: 39 -->
