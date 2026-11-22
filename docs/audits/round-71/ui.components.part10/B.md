## A carry whose release lands past the slop with no move past it picks the tool as well as dropping
- where: packages/ui/src/components/ToolPalette/useToolCarry.tsx:44 (useToolCarry press, onMove/onEnd)
- scenario: `moved` is set only in `onMove`; `onEnd` never tests its own event against `dragPx`. When the pointerup sits past the slop but the last delivered pointermove did not (a fast flick whose final moves are coalesced, a pen lift), `moved` stays false at release. `startCarry` still drops the payload on the surface under the release, and the click that follows is not swallowed, so the press both carries and picks the tool, and no ghost ever showed. The documented contract is that a press moving further than the slop "carries and picks nothing". The check should also run on the `onEnd` event (`pastDragThreshold(origin, result.event, dragPx)`).
- evidence: read (useToolCarry.tsx; routing carry.ts `onEnd` runs `step(e)` and the drop on the release event itself)
- severity: low

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
